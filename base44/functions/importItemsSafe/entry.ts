import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return null; // inválido
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden importar datos' }, { status: 403 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'Usuario sin negocio asignado' }, { status: 400 });
    }

    const { import_type, rows } = await req.json();

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

      const VALID_UNITS = ['pieza', 'kg', 'litro', 'metro', 'caja', 'paquete'];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-based, row 1 is header

        const nombre = (row['nombre'] || '').trim();
        if (!nombre) {
          results.push({ row: rowNum, status: 'error', message: 'El campo "nombre" es obligatorio' });
          continue;
        }

        const precioMenudeo = parseFloat(row['precio_menudeo'] || row['precio_venta'] || '0');
        if (isNaN(precioMenudeo) || precioMenudeo < 0) {
          results.push({ row: rowNum, nombre, status: 'error', message: 'El precio de menudeo debe ser un número mayor o igual a cero' });
          continue;
        }

        const unit = (row['unidad'] || 'pieza').trim().toLowerCase();
        if (!VALID_UNITS.includes(unit)) {
          results.push({ row: rowNum, nombre, status: 'error', message: `Unidad inválida "${unit}". Valores aceptados: ${VALID_UNITS.join(', ')}` });
          continue;
        }

        // Category linkage by name
        let categoryId = null;
        const catName = (row['categoria'] || '').trim();
        if (catName) {
          categoryId = catMap[catName.toLowerCase()];
          if (!categoryId) {
            results.push({ row: rowNum, nombre, status: 'error', message: `La categoría "${catName}" no existe. Créala primero en Configuración → Categorías` });
            continue;
          }
        }

        const product = {
          name: nombre,
          sku: (row['sku'] || '').trim(),
          barcode: (row['codigo_barras'] || '').trim(),
          description: (row['descripcion'] || '').trim(),
          purchase_price: parseFloat(row['precio_compra'] || '0') || 0,
          retail_sale_price: precioMenudeo,
          wholesale_sale_price: parseFloat(row['precio_mayoreo'] || '0') || 0,
          stock: parseFloat(row['stock'] || '0') || 0,
          min_stock: parseFloat(row['stock_minimo'] || '5') || 5,
          unit,
          tax_rate: 16,
          status: 'active',
          business_id: businessId,
          ...(categoryId ? { category: categoryId } : {}),
        };

        // Cross-tenant guard: double-check businessId matches
        const created = await base44.asServiceRole.entities.Product.create(product);

        // Register initial stock movement
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

        const nombre = (row['nombre'] || '').trim();
        if (!nombre) {
          results.push({ row: rowNum, status: 'error', message: 'El campo "nombre" es obligatorio' });
          continue;
        }

        const forceWholesale = parseBool(row['force_wholesale_all_products'] || 'false');
        const forcePurchase = parseBool(row['force_purchase_all_products'] || 'false');

        if (forceWholesale === null) {
          results.push({ row: rowNum, nombre, status: 'error', message: 'El campo "force_wholesale_all_products" tiene un valor inválido. Use: true/false, 1/0, sí/no' });
          continue;
        }
        if (forcePurchase === null) {
          results.push({ row: rowNum, nombre, status: 'error', message: 'El campo "force_purchase_all_products" tiene un valor inválido. Use: true/false, 1/0, sí/no' });
          continue;
        }
        if (forceWholesale && forcePurchase) {
          results.push({ row: rowNum, nombre, status: 'error', message: 'No se puede activar "precio mayoreo" y "precio compra" al mismo tiempo para el mismo cliente' });
          continue;
        }

        await base44.asServiceRole.entities.Client.create({
          name: nombre,
          business_name: (row['nombre_negocio'] || '').trim(),
          giro: (row['giro'] || '').trim(),
          phone: (row['telefono'] || '').trim(),
          email: (row['email'] || '').trim(),
          address: (row['direccion'] || '').trim(),
          force_wholesale_all_products: forceWholesale,
          force_purchase_all_products: forcePurchase,
          status: 'active',
          business_id: businessId,
        });

        results.push({ row: rowNum, nombre, status: 'ok' });
      }
    }

    // ─── CATEGORÍAS ──────────────────────────────────────────────────────────
    else if (import_type === 'categories') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const nombre = (row['nombre'] || '').trim();
        if (!nombre) {
          results.push({ row: rowNum, status: 'error', message: 'El campo "nombre" es obligatorio' });
          continue;
        }

        const minQtyRaw = (row['cantidad_minima_mayoreo'] || '').trim();
        const minQty = minQtyRaw !== '' ? parseFloat(minQtyRaw) : null;

        await base44.asServiceRole.entities.Category.create({
          name: nombre,
          description: (row['descripcion'] || '').trim(),
          color: '#6366f1',
          business_id: businessId,
          ...(minQty != null && !isNaN(minQty) && minQty >= 0 ? { wholesale_min_qty: minQty } : {}),
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});