/**
 * Exportar e importar deben llevar TODOS los campos de la entidad, y lo exportado
 * debe poder importarse de vuelta sin perder nada.
 *
 * Intención (no solo comportamiento):
 *  1. Cada campo de base44/entities/{Product,Category,Client}.jsonc (menos business_id,
 *     que fija el servidor) tiene columna de importación Y la columna existe en el
 *     servidor. Un campo nuevo sin columna hace fallar esta prueba.
 *  2. Las columnas de src/lib/importSpec.js (cliente) y base44/shared/importMapping.ts
 *     (servidor) son idénticas.
 *  3. Las exportaciones de lista (Productos, Movimientos, Caja chica) cubren cada campo
 *     del esquema; los costos solo salen con permiso.
 *  4. Round-trip: entidad → CSV de importación (con comas/comillas/saltos de línea) →
 *     parser → importItemsSafe → registros equivalentes.
 *
 * Run: deno test -A base44/tests/import_export_fields_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as server from "../shared/importMapping.ts";
// @ts-nocheck: módulos JS del cliente (sin tipos)
import * as spec from "../../src/lib/importSpec.js";
import { parseCSVMatrix, parseCSVObjects, toCSV } from "../../src/lib/csv.js";
import { buildImportCSV } from "../../src/lib/exportImportFormat.js";
import { buildMovementExport, buildPettyCashExport, buildProductExport } from "../../src/lib/exportColumns.js";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function schemaFields(name: string): Promise<string[]> {
  const txt = await Deno.readTextFile(new URL(`../entities/${name}.jsonc`, import.meta.url));
  return Object.keys(JSON.parse(txt).properties).filter((k) => k !== "business_id");
}

// ─── 1 y 2: cobertura del esquema y paridad cliente/servidor ────────────────
const CASES = [
  { entity: "Product", type: "products", map: spec.PRODUCT_FIELD_COLUMNS, headers: spec.PRODUCT_HEADERS, srv: server.PRODUCT_HEADERS },
  { entity: "Client", type: "clients", map: spec.CLIENT_FIELD_COLUMNS, headers: spec.CLIENT_HEADERS, srv: server.CLIENT_HEADERS },
  { entity: "Category", type: "categories", map: spec.CATEGORY_FIELD_COLUMNS, headers: spec.CATEGORY_HEADERS, srv: server.CATEGORY_HEADERS },
];
for (const c of CASES) {
  Deno.test(`${c.entity}: cada campo del esquema tiene columna de importación y exportación`, async () => {
    const fields = await schemaFields(c.entity);
    for (const f of fields) {
      const col = (c.map as Row)[f];
      assert(col, `El campo ${c.entity}.${f} no tiene columna en importSpec.js`);
      assert(c.headers.includes(col), `${col} falta en los encabezados de ${c.type}`);
    }
    // Y al revés: no hay columnas apuntando a campos que no existen.
    for (const f of Object.keys(c.map)) assert(fields.includes(f), `${f} no existe en ${c.entity}.jsonc`);
  });
  Deno.test(`${c.entity}: columnas del cliente == columnas del servidor`, () => {
    assertEquals([...c.headers], [...c.srv]);
  });
}

// ─── 3: exportaciones de lista cubren el esquema ────────────────────────────
Deno.test("Exportar Productos: una columna por campo del esquema; costo solo con permiso", async () => {
  const fields = (await schemaFields("Product")).filter((f) => f !== "category" || true);
  const withCost = buildProductExport([], [], [], { includeCost: true }).columns.map((c: Row) => c.key);
  for (const f of fields) assert(withCost.includes(f), `Exportación de productos sin columna para ${f}`);
  const noCost = buildProductExport([], [], [], { includeCost: false }).columns.map((c: Row) => c.key);
  assert(!noCost.includes("purchase_price"));
  const { rows } = buildProductExport([{ name: "a", purchase_price: 9 }], [], [], { includeCost: false });
  assert(!("purchase_price" in rows[0]), "el costo no debe viajar en las filas sin permiso");
});

Deno.test("Exportar Movimientos: cubre el esquema; cost_price solo con permiso", async () => {
  const fields = await schemaFields("Movement");
  // Cada campo del esquema ↔ columna de exportación (nombre en español).
  const MAP: Row = {
    cost_price: "costo", paid: "pagado", product_id: "producto_id", product_name: "producto",
    quantity: "cantidad", quotation_id: "cotizacion_id", reason: "cliente", reference: "forma_pago",
    stock_after: "stock_despues", stock_apply_error: "error_stock", stock_apply_state: "estado_stock",
    stock_pending_at: "stock_pendiente_desde", stock_before: "stock_antes", stock_applied: "stock_aplicado",
    total: "total", type: "tipo", unit_price: "precio_unit",
  };
  const opts = { typeLabel: (t: string) => t, finalTotal: (m: Row) => m.total, includeCost: true };
  const cols = buildMovementExport([], opts).columns.map((c: Row) => c.key);
  assert(cols.includes("fecha"));
  for (const f of fields) {
    assert(MAP[f], `Movement.${f} sin mapeo en la prueba: ¿falta columna de exportación?`);
    assert(cols.includes(MAP[f]), `Exportación de movimientos sin columna ${MAP[f]} (${f})`);
  }
  const noCost = buildMovementExport([{ cost_price: 5 }], { ...opts, includeCost: false });
  assert(!noCost.columns.some((c: Row) => c.key === "costo"));
  assert(!("costo" in noCost.rows[0]));
});

Deno.test("Exportar Caja chica: cubre el esquema", async () => {
  const fields = await schemaFields("PettyCashMovement");
  const MAP: Row = {
    amount: "monto", category: "categoria", description: "descripcion", generated_by_system: "generado_por_sistema",
    movement_date: "fecha", movement_type: "tipo", notes: "notas", origin_id: "origen_id", origin_type: "origen_tipo",
    payment_method_snapshot: "metodo_pago", reference: "referencia",
  };
  const cols = buildPettyCashExport([], (t: string) => t).columns.map((c: Row) => c.key);
  for (const f of fields) {
    assert(MAP[f], `PettyCashMovement.${f} sin mapeo: ¿falta columna?`);
    assert(cols.includes(MAP[f]), `Caja chica sin columna ${MAP[f]} (${f})`);
  }
});

// ─── 4: round-trip entidad → CSV → importItemsSafe ──────────────────────────
const tables: Record<string, Row[]> = {};
let seq = 0;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
function entity(table: string) {
  return {
    filter: (q: Row = {}) =>
      Promise.resolve((tables[table] ??= []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    create: (data: Row) => {
      const row = { id: `${table}-${++seq}`, ...data };
      (tables[table] ??= []).push(row);
      return Promise.resolve({ ...row });
    },
  };
}
const USER = { id: "u1", email: "d@b1.com", role: "owner", business_id: "b1" };
G.__sf = {
  client() {
    const entities = new Proxy({}, { get: (_t, name: string) => entity(name) });
    return { auth: { me: () => Promise.resolve(USER) }, entities, asServiceRole: { entities } };
  },
};
const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__sf.client(r); }");
async function load(rel: string) {
  const abs = new URL(`../../${rel}`, import.meta.url);
  const src = await Deno.readTextFile(abs);
  const out = "// @ts-nocheck\n" + src
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
    .replace(/from\s+'(\.[^']+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${await Deno.makeTempDir()}/h.ts`;
  await Deno.writeTextFile(file, out);
  return (await import(`file://${file}`)).handle as (r: Request) => Promise<Response>;
}
const importItems = await load("base44/functions/products/handlers/importItemsSafe.ts");
const run = async (import_type: string, rows: Row[]) => {
  const res = await importItems(new Request("http://l/fn", { method: "POST", body: JSON.stringify({ import_type, rows }) }));
  return await res.json() as Row;
};
function reset() {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.Business = [{ id: "b1", billing_status: "active" }];
}
/** Archivo exportado → texto → filas, exactamente como lo haría el navegador. */
const viaFile = (type: string, rows: Row[], opts = {}) => parseCSVObjects(buildImportCSV(type, rows, opts));

Deno.test("Round-trip Productos: exportar → importar conserva TODOS los campos (comas, comillas y saltos de línea)", async () => {
  reset();
  tables.Category = [{ id: "c1", business_id: "b1", name: "Electrónica" }];
  tables.Supplier = [{ id: "s1", business_id: "b1", name: "Proveedor Uno" }];
  const original = {
    name: 'Cable "USB", 2m', sku: "SKU-1", barcode: "7501234567890", description: "Línea 1\nLínea 2, con coma",
    purchase_price: 12.5, retail_sale_price: 30, wholesale_sale_price: 25, stock: 7, min_stock: 3, unit: "caja",
    category: "c1", supplier: "s1", tax_rate: 0, status: "inactive", image_url: "https://x.mx/a.jpg?x=1,2",
  };
  const rows = spec.productsToImportRows([original], tables.Category, tables.Supplier);
  const out = await run("products", viaFile("products", rows));
  assertEquals(out.errorCount, 0, JSON.stringify(out.results));
  const created = tables.Product[0];
  for (const f of Object.keys(original)) assertEquals(created[f], (original as Row)[f], `campo ${f}`);
  assertEquals(created.business_id, "b1");
});

Deno.test("Round-trip Clientes y Categorías conservan todos los campos", async () => {
  reset();
  const client = {
    name: "Juan", business_name: "Ferretería, S.A.", giro: "Ferretería", rfc: "PEPJ800101ABC", phone: "449", email: "j@x.com",
    address: "Av. 1\nCol. Centro", notes: 'Dice "hola"', status: "inactive",
    force_wholesale_all_products: true, force_purchase_all_products: false, force_zero_price: false,
  };
  const cat = { name: "Herr", description: "desc, coma", color: "#f59e0b", wholesale_min_qty: 12 };
  const r1 = await run("clients", viaFile("clients", spec.clientsToImportRows([client])));
  const r2 = await run("categories", viaFile("categories", spec.categoriesToImportRows([cat])));
  assertEquals([r1.errorCount, r2.errorCount], [0, 0], JSON.stringify([r1.results, r2.results]));
  for (const f of Object.keys(client)) assertEquals(tables.Client[0][f], (client as Row)[f], `Client.${f}`);
  for (const f of Object.keys(cat)) assertEquals(tables.Category[0][f], (cat as Row)[f], `Category.${f}`);
});

Deno.test("Sin permiso de costo la columna precio_compra no sale y el archivo sigue importándose", async () => {
  reset();
  const rows = spec.productsToImportRows([{ name: "P", purchase_price: 99, retail_sale_price: 5 }]);
  const csv = buildImportCSV("products", rows, { omit: ["precio_compra"] });
  assert(!csv.split("\n")[0].includes("precio_compra"));
  assert(!csv.includes("99"));
  const out = await run("products", parseCSVObjects(csv));
  assertEquals(out.errorCount, 0);
});

Deno.test("Importar acepta encabezados con acentos, mayúsculas, alias y plantillas viejas", async () => {
  reset();
  const out = await run("products", [
    { Nombre: "Viejo", "Código de Barras": "123", precio_venta: "10", Unidad: "KG", "IVA": "16%", "Estatus": "Activo" },
    { name: "Inglés", barcode: "456", precio_menudeo: "$1,5", status: "inactive" },
  ]);
  assertEquals(out.successCount, 1, JSON.stringify(out.results));
  assertEquals(tables.Product[0].barcode, "123");
  assertEquals(tables.Product[0].unit, "kg");
  assertEquals(out.results[1].status, "error"); // "$1,5" no es número válido → error por fila, no 0 silencioso
});

Deno.test("Importar valida tipos y reporta error por fila (sin abortar el archivo)", async () => {
  reset();
  tables.Category = [{ id: "c1", business_id: "b1", name: "Ok" }];
  const out = await run("products", [
    { nombre: "A", precio_menudeo: "abc" },
    { nombre: "B", precio_menudeo: "1", iva: "8" },
    { nombre: "C", precio_menudeo: "1", estatus: "quizá" },
    { nombre: "D", precio_menudeo: "1", proveedor: "Fantasma" },
    { nombre: "E", precio_menudeo: "1", categoria: "Ok" },
  ]);
  assertEquals(out.results.map((r: Row) => r.status), ["error", "error", "error", "error", "ok"]);
  const cl = await run("clients", [
    { nombre: "X", force_zero_price: "true", force_wholesale_all_products: "true" },
    { nombre: "Y", force_zero_price: "tal vez" },
  ]);
  assertEquals(cl.errorCount, 2);
  const ct = await run("categories", [{ nombre: "Z", color: "rojo" }, { nombre: "W", cantidad_minima_mayoreo: "-1" }]);
  assertEquals(ct.errorCount, 2);
});

Deno.test("Importar: fila con stock negativo queda en error, sin Product ni Movement; stock 0 y positivo siguen igual", async () => {
  reset();
  const out = await run("products", [
    { nombre: "Neg", precio_menudeo: "1", stock: "-5" },
    { nombre: "Cero", precio_menudeo: "1", stock: "0" },
    { nombre: "Pos", precio_menudeo: "1", precio_compra: "2", stock: "7" },
  ]);
  assertEquals(out.results.map((r: Row) => r.status), ["error", "ok", "ok"]);
  assertEquals(out.results[0].message, "El stock no puede ser negativo"); // mismo texto que createProductSafe
  assertEquals(out.successCount, 2);
  assertEquals(out.errorCount, 1);
  assertEquals(tables.Product.map((p) => p.name), ["Cero", "Pos"]);
  assertEquals(tables.Product.find((p) => p.name === "Cero")?.stock, 0);
  assertEquals(tables.Product.find((p) => p.name === "Pos")?.stock, 7);
  // Solo la fila positiva genera movimiento de entrada (stock inicial).
  assertEquals(tables.Movement.length, 1);
  assertEquals(tables.Movement[0].product_name, "Pos");
  assertEquals(tables.Movement[0].type, "entry");
  assertEquals(tables.Movement[0].quantity, 7);
});

Deno.test("importItemsSafe sigue exigiendo admin y licencia vigente", async () => {
  reset();
  tables.Business = [{ id: "b1", billing_status: "suspended" }];
  const res = await importItems(new Request("http://l/fn", { method: "POST", body: JSON.stringify({ import_type: "categories", rows: [{ nombre: "Z" }] }) }));
  assertEquals(res.status, 403);
  tables.Business = [{ id: "b1", billing_status: "active" }];
  USER.role = "staff";
  assertEquals((await importItems(new Request("http://l/fn", { method: "POST", body: JSON.stringify({ import_type: "categories", rows: [{ nombre: "Z" }] }) }))).status, 403);
  USER.role = "owner";
});

Deno.test("CSV: parser y serializador son inversos con comillas, comas y CRLF", () => {
  const m = [["a,b", 'c"d', "e\nf", ""], ["1", "2", "3", "4"]];
  assertEquals(parseCSVMatrix(toCSV(m[0].map(String), [m[1]])), m);
  assertEquals(parseCSVMatrix("﻿x,y\r\n1,2\r\n"), [["x", "y"], ["1", "2"]]);
});

Deno.test("Exportar Productos: sin Proveedores:view no sale la columna proveedor ni se cargan proveedores", async () => {
  const sup = [{ id: "s1", name: "Prov Uno" }];
  const prod = [{ name: "a", supplier: "s1" }];
  const full = buildProductExport(prod, [], sup, { includeSupplier: true });
  assert(full.columns.some((c: Row) => c.key === "supplier"));
  assertEquals(full.rows[0].supplier, "Prov Uno");
  const none = buildProductExport(prod, [], [], { includeSupplier: false });
  assert(!none.columns.some((c: Row) => c.key === "supplier"));
  assert(!("supplier" in none.rows[0]), "sin permiso no debe viajar el proveedor (ni vacío)");
  // La página solo consulta proveedores con permiso y bloquea la exportación hasta que carguen.
  const page = await Deno.readTextFile(new URL("../../src/pages/Products.jsx", import.meta.url));
  assert(page.includes("useSuppliers(businessId, { enabled: canSuppliers })"));
  assert(page.includes("canSuppliers && !suppliersQuery.isSuccess"));
  assert(page.includes("!permissionsLoading && can('Proveedores', 'view')"), "no consultar proveedores mientras cargan los permisos");
  assert(page.includes("permissionsLoading ||"));
  const hook = await Deno.readTextFile(new URL("../../src/hooks/queries/index.js", import.meta.url));
  assert(hook.includes("enabled: !!businessId && enabled"));
});
