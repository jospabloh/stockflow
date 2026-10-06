import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { buildDuplicateIndex, checkAgainstIndex, addToIndex, duplicateErrorMessage } from '../../../shared/productDuplicateCheck.ts';
import { getAuthUser } from '../../../shared/authUser.ts';
import { mapProductRow, mapClientRow, mapCategoryRow, normalizeRow } from '../../../shared/importMapping.ts';

/**
 * importItemsSafe — Importación segura de Productos, Clientes o Categorías.
 * Valida propiedad del negocio, aplica reglas de negocio y rechaza filas inválidas.
 *
 * Payload esperado:
 * {
 *   import_type: "products" | "clients" | "categories",
 *   rows: Array<object>   // filas ya parseadas del CSV
 * }
 */

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo administradores pueden importar datos' }, { status: 403 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'Usuario sin negocio asignado' }, { status: 400 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: businessId });
    const billingStatus = bizArr?.[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const { import_type, rows: rawRows } = await req.json();
    // Encabezados sin distinguir mayúsculas/acentos; acepta alias (name, barcode, ...).
    const rows = Array.isArray(rawRows) ? rawRows.map((r) => normalizeRow(r)) : rawRows;

    if (!import_type || !Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'Datos de importación inválidos' }, { status: 400 });
    }

    const results = [];

    // ─── PRODUCTOS ───────────────────────────────────────────────────────────
    if (import_type === 'products') {
      // Load existing categories for name → id lookup
      const existingCats = await base44.asServiceRole.entities.Category.filter({ business_id: businessId });
      const catMap = {};
      for (const c of existingCats) {
        catMap[c.name.trim().toLowerCase()] = c.id;
      }

      // Load suppliers for name → id lookup
      const existingSuppliers = await base44.asServiceRole.entities.Supplier.filter({ business_id: businessId });
      const supMap: Record<string, string> = {};
      for (const sp of existingSuppliers) {
        supMap[String(sp.name ?? '').trim().toLowerCase()] = sp.id;
      }

      // Load existing products for duplicate detection
      const existingProducts = await base44.asServiceRole.entities.Product.filter({ business_id: businessId });
      const dupIndex = buildDuplicateIndex(existingProducts);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-based, row 1 is header
        const nombre = row['nombre'] || '';

        const mapped = mapProductRow(row);
        if ('error' in mapped) {
          results.push({ row: rowNum, ...(nombre ? { nombre } : {}), status: 'error', message: mapped.error });
          continue;
        }
        const { product: base, categoryName, supplierName } = mapped.value;

        // Category / supplier linkage by name
        let categoryId = null;
        if (categoryName) {
          categoryId = catMap[categoryName.toLowerCase()];
          if (!categoryId) {
            results.push({ row: rowNum, nombre, status: 'error', message: `La categoría "${categoryName}" no existe. Créala primero en Configuración → Categorías` });
            continue;
          }
        }
        let supplierId = null;
        if (supplierName) {
          supplierId = supMap[supplierName.toLowerCase()];
          if (!supplierId) {
            results.push({ row: rowNum, nombre, status: 'error', message: `El proveedor "${supplierName}" no existe. Créalo primero en Proveedores` });
            continue;
          }
        }

        // DUPLICATE CHECK — against existing products and earlier rows in this batch
        const dup = checkAgainstIndex(dupIndex, nombre, base.sku as string, base.barcode as string);
        if (dup.duplicate) {
          results.push({ row: rowNum, nombre, status: 'error', message: `Duplicado: ${duplicateErrorMessage(dup).replace('Ya existe un producto con el mismo ', 'ya existe un producto con el mismo ')}` });
          continue;
        }

        const product = {
          ...base,
          business_id: businessId,
          ...(categoryId ? { category: categoryId } : {}),
          ...(supplierId ? { supplier: supplierId } : {}),
        } as Record<string, any>;

        // Add to duplicate index so subsequent rows in this batch are checked against it
        addToIndex(dupIndex, product.name, product.sku, product.barcode);

        const created = await base44.asServiceRole.entities.Product.create(product);

        // Register initial stock movement.
        // El stock inicial YA quedó fijado en Product.create, por eso este
        // movimiento se marca stock_applied=true: documenta el origen del stock
        // sin que applyMovementStock/automatización lo sume de nuevo (evita doble).
        if (product.stock > 0 && created?.id) {
          await base44.asServiceRole.entities.Movement.create({
            product_id: created.id,
            product_name: product.name,
            type: 'entry',
            quantity: product.stock,
            unit_price: product.purchase_price || 0,
            total: product.stock * (product.purchase_price || 0),
            reason: 'Stock inicial',
            reference: 'Importación CSV',
            stock_after: product.stock,
            business_id: businessId,
            stock_applied: true,
          });
        }

        results.push({ row: rowNum, nombre, status: 'ok' });
      }
    }

    // ─── CLIENTES ────────────────────────────────────────────────────────────
    else if (import_type === 'clients') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const nombre = row['nombre'] || '';
        const mapped = mapClientRow(row);
        if ('error' in mapped) {
          results.push({ row: rowNum, ...(nombre ? { nombre } : {}), status: 'error', message: mapped.error });
          continue;
        }

        await base44.asServiceRole.entities.Client.create({
          ...mapped.value,
          business_id: businessId,
        });

        results.push({ row: rowNum, nombre, status: 'ok' });
      }
    }

    // ─── CATEGORÍAS ──────────────────────────────────────────────────────────
    else if (import_type === 'categories') {
      // Names are unique per tenant (case-insensitive, trimmed) — also within the file itself.
      const existingCatsForDup = await base44.asServiceRole.entities.Category.filter({ business_id: businessId }, undefined, 5000);
      const usedNames = new Set<string>(
        (existingCatsForDup || []).map((c: { name?: string }) => String(c.name ?? '').trim().toLocaleLowerCase()),
      );
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const nombre = row['nombre'] || '';
        const mapped = mapCategoryRow(row);
        if ('error' in mapped) {
          results.push({ row: rowNum, ...(nombre ? { nombre } : {}), status: 'error', message: mapped.error });
          continue;
        }

        const nameKey = nombre.toLocaleLowerCase();
        if (usedNames.has(nameKey)) {
          results.push({ row: rowNum, nombre, status: 'error', message: `Ya existe una categoría con el nombre "${nombre}"`, code: 'duplicate_name' });
          continue;
        }

        usedNames.add(nameKey);
        await base44.asServiceRole.entities.Category.create({
          ...mapped.value,
          business_id: businessId,
        });

        results.push({ row: rowNum, nombre, status: 'ok' });
      }
    } else {
      return Response.json({ error: `Tipo de importación no reconocido: "${import_type}"` }, { status: 400 });
    }

    const successCount = results.filter(r => r.status === 'ok').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return Response.json({ success: true, results, successCount, errorCount });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}