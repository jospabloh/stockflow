import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle, Database } from "lucide-react";

const makeCategories = (bid) => [
  { name: "Herramientas Manuales", description: "Desarmadores, llaves, martillos, pinzas", color: "#EF4444", business_id: bid },
  { name: "Herramientas Eléctricas", description: "Taladros, esmeriles, sierras eléctricas", color: "#F97316", business_id: bid },
  { name: "Tornillería y Fijaciones", description: "Tornillos, tuercas, pijas, taquetes", color: "#EAB308", business_id: bid },
  { name: "Plomería", description: "Tubos, codos, llaves de paso, mangueras", color: "#3B82F6", business_id: bid },
  { name: "Electricidad", description: "Cable, contactos, interruptores, focos", color: "#8B5CF6", business_id: bid },
  { name: "Pinturas y Acabados", description: "Pintura vinílica, esmalte, brochas, rodillos", color: "#EC4899", business_id: bid },
  { name: "Materiales de Construcción", description: "Cemento, varilla, block, arena", color: "#6B7280", business_id: bid },
];

const makeSuppliers = (bid) => [
  { name: "Distribuidora Nacobre", contact_name: "Ramón Gutiérrez", email: "ventas@nacobre.mx", phone: "449-200-1111", address: "Zona Industrial, Aguascalientes", rfc: "DNA900101XY1", notes: "Plomería y cobre", business_id: bid },
  { name: "Truper Herramientas", contact_name: "Laura Pérez", email: "lperez@truper.com", phone: "55-5000-2222", address: "CDMX", rfc: "THE850601AB2", notes: "Herramientas manuales y eléctricas", business_id: bid },
  { name: "DeWalt México", contact_name: "Carlos Mendoza", email: "cmendoza@dewalt.mx", phone: "55-4000-3333", address: "Monterrey, NL", rfc: "DWM010101CD3", notes: "Herramientas eléctricas profesionales", business_id: bid },
  { name: "Pinturas Comex", contact_name: "Sofía Ramos", email: "sramos@comex.mx", phone: "449-300-4444", address: "Aguascalientes, Ags.", rfc: "PCO750301EF4", notes: "Pinturas, esmaltes y acabados", business_id: bid },
  { name: "Aceros y Materiales del Centro", contact_name: "Miguel Torres", email: "mtorres@aceroscentro.mx", phone: "449-400-5555", address: "Col. Industrial, Aguascalientes", rfc: "AMC920501GH5", notes: "Varilla, perfiles y construcción", business_id: bid },
];

const makeClients = (bid) => [
  { name: "Constructora Hernández e Hijos", email: "contacto@constructorahh.mx", phone: "449-555-1001", address: "Av. López Mateos 340, Aguascalientes", rfc: "CHH800101IJ6", notes: "Cliente frecuente, compra al mayoreo", status: "active", business_id: bid },
  { name: "IMSS Delegación Ags", email: "mantenimiento@imss-ags.gob.mx", phone: "449-555-2002", address: "Av. Convención 100, Aguascalientes", rfc: "MSS421016000", notes: "Requiere factura siempre", status: "active", business_id: bid },
  { name: "Arq. Patricia Velarde", email: "pvelarde.arq@gmail.com", phone: "449-555-3003", address: "Fracc. Villa Jardín, Aguascalientes", rfc: "VEPA850312KL7", notes: "Arquitecta independiente", status: "active", business_id: bid },
  { name: "Hotel Boutique Casa Real", email: "compras@casareal.mx", phone: "449-555-4004", address: "Centro Histórico, Aguascalientes", rfc: "HCR991201MN8", notes: "Mantenimiento constante del hotel", status: "active", business_id: bid },
  { name: "Juan Carlos Ríos (Plomero)", email: "jcrios.plomero@hotmail.com", phone: "449-555-5005", address: "Col. Morelos, Aguascalientes", rfc: "RICJ780901OP9", notes: "Plomero independiente, recurrente", status: "active", business_id: bid },
  { name: "Municipio de Jesús María", email: "obras@jesusmaria.gob.mx", phone: "449-555-6006", address: "Prol. Mahatma Gandhi s/n, Jesús María", rfc: "MJM800101QR0", notes: "Requiere cotización formal", status: "active", business_id: bid },
];

const makePettyCash = (bid) => [
  { business_id: bid, movement_type: "initial_fund", amount: 3000, description: "Fondo inicial de caja chica", movement_date: "2026-03-01", category: "Fondo" },
  { business_id: bid, movement_type: "expense", amount: 85, description: "Papelería para facturas", category: "Papelería", movement_date: "2026-03-05", reference: "TKT-001" },
  { business_id: bid, movement_type: "expense", amount: 220, description: "Gasolina reparto zona norte", category: "Transporte", movement_date: "2026-03-08", reference: "TKT-002" },
  { business_id: bid, movement_type: "expense", amount: 150, description: "Limpieza y artículos de aseo", category: "Limpieza", movement_date: "2026-03-10", reference: "TKT-003" },
  { business_id: bid, movement_type: "income", amount: 1500, description: "Reposición de fondo aprobada por gerencia", category: "Reposición", movement_date: "2026-03-12" },
  { business_id: bid, movement_type: "expense", amount: 95, description: "Café y agua para empleados", category: "Víveres", movement_date: "2026-03-15", reference: "TKT-004" },
  { business_id: bid, movement_type: "expense", amount: 340, description: "Flete express piezas urgentes", category: "Transporte", movement_date: "2026-03-18", reference: "TKT-005" },
  { business_id: bid, movement_type: "expense", amount: 60, description: "Copia de llaves bodega nueva", category: "Servicios", movement_date: "2026-03-20", reference: "TKT-006" },
];

const categories_placeholder = [
...
  { name: "Herramientas Manuales", description: "Desarmadores, llaves, martillos, pinzas", color: "#EF4444", business_id: BUSINESS_ID },
  { name: "Herramientas Eléctricas", description: "Taladros, esmeriles, sierras eléctricas", color: "#F97316", business_id: BUSINESS_ID },
  { name: "Tornillería y Fijaciones", description: "Tornillos, tuercas, pijas, taquetes", color: "#EAB308", business_id: BUSINESS_ID },
  { name: "Plomería", description: "Tubos, codos, llaves de paso, mangueras", color: "#3B82F6", business_id: BUSINESS_ID },
  { name: "Electricidad", description: "Cable, contactos, interruptores, focos", color: "#8B5CF6", business_id: BUSINESS_ID },
  { name: "Pinturas y Acabados", description: "Pintura vinílica, esmalte, brochas, rodillos", color: "#EC4899", business_id: BUSINESS_ID },
  { name: "Materiales de Construcción", description: "Cemento, varilla, block, arena", color: "#6B7280", business_id: BUSINESS_ID },
];

const suppliers = [
  { name: "Distribuidora Nacobre", contact_name: "Ramón Gutiérrez", email: "ventas@nacobre.mx", phone: "449-200-1111", address: "Zona Industrial, Aguascalientes", rfc: "DNA900101XY1", notes: "Plomería y cobre", business_id: BUSINESS_ID },
  { name: "Truper Herramientas", contact_name: "Laura Pérez", email: "lperez@truper.com", phone: "55-5000-2222", address: "CDMX", rfc: "THE850601AB2", notes: "Herramientas manuales y eléctricas", business_id: BUSINESS_ID },
  { name: "DeWalt México", contact_name: "Carlos Mendoza", email: "cmendoza@dewalt.mx", phone: "55-4000-3333", address: "Monterrey, NL", rfc: "DWM010101CD3", notes: "Herramientas eléctricas profesionales", business_id: BUSINESS_ID },
  { name: "Pinturas Comex", contact_name: "Sofía Ramos", email: "sramos@comex.mx", phone: "449-300-4444", address: "Aguascalientes, Ags.", rfc: "PCO750301EF4", notes: "Pinturas, esmaltes y acabados", business_id: BUSINESS_ID },
  { name: "Aceros y Materiales del Centro", contact_name: "Miguel Torres", email: "mtorres@aceroscentro.mx", phone: "449-400-5555", address: "Col. Industrial, Aguascalientes", rfc: "AMC920501GH5", notes: "Varilla, perfiles y construcción", business_id: BUSINESS_ID },
];

const clients = [
  { name: "Constructora Hernández e Hijos", email: "contacto@constructorahh.mx", phone: "449-555-1001", address: "Av. López Mateos 340, Aguascalientes", rfc: "CHH800101IJ6", notes: "Cliente frecuente, compra al mayoreo", status: "active", business_id: BUSINESS_ID },
  { name: "IMSS Delegación Ags", email: "mantenimiento@imss-ags.gob.mx", phone: "449-555-2002", address: "Av. Convención 100, Aguascalientes", rfc: "MSS421016000", notes: "Requiere factura siempre", status: "active", business_id: BUSINESS_ID },
  { name: "Arq. Patricia Velarde", email: "pvelarde.arq@gmail.com", phone: "449-555-3003", address: "Fracc. Villa Jardín, Aguascalientes", rfc: "VEPA850312KL7", notes: "Arquitecta independiente", status: "active", business_id: BUSINESS_ID },
  { name: "Hotel Boutique Casa Real", email: "compras@casareal.mx", phone: "449-555-4004", address: "Centro Histórico, Aguascalientes", rfc: "HCR991201MN8", notes: "Mantenimiento constante del hotel", status: "active", business_id: BUSINESS_ID },
  { name: "Juan Carlos Ríos (Plomero)", email: "jcrios.plomero@hotmail.com", phone: "449-555-5005", address: "Col. Morelos, Aguascalientes", rfc: "RICJ780901OP9", notes: "Plomero independiente, recurrente", status: "active", business_id: BUSINESS_ID },
  { name: "Municipio de Jesús María", email: "obras@jesusmaria.gob.mx", phone: "449-555-6006", address: "Prol. Mahatma Gandhi s/n, Jesús María", rfc: "MJM800101QR0", notes: "Requiere cotización formal", status: "active", business_id: BUSINESS_ID },
];

const pettyCash = [
  { business_id: BUSINESS_ID, movement_type: "initial_fund", amount: 3000, description: "Fondo inicial de caja chica", movement_date: "2026-03-01", category: "Fondo" },
  { business_id: BUSINESS_ID, movement_type: "expense", amount: 85, description: "Papelería para facturas", category: "Papelería", movement_date: "2026-03-05", reference: "TKT-001" },
  { business_id: BUSINESS_ID, movement_type: "expense", amount: 220, description: "Gasolina reparto zona norte", category: "Transporte", movement_date: "2026-03-08", reference: "TKT-002" },
  { business_id: BUSINESS_ID, movement_type: "expense", amount: 150, description: "Limpieza y artículos de aseo", category: "Limpieza", movement_date: "2026-03-10", reference: "TKT-003" },
  { business_id: BUSINESS_ID, movement_type: "income", amount: 1500, description: "Reposición de fondo aprobada por gerencia", category: "Reposición", movement_date: "2026-03-12" },
  { business_id: BUSINESS_ID, movement_type: "expense", amount: 95, description: "Café y agua para empleados", category: "Víveres", movement_date: "2026-03-15", reference: "TKT-004" },
  { business_id: BUSINESS_ID, movement_type: "expense", amount: 340, description: "Flete express piezas urgentes", category: "Transporte", movement_date: "2026-03-18", reference: "TKT-005" },
  { business_id: BUSINESS_ID, movement_type: "expense", amount: 60, description: "Copia de llaves bodega nueva", category: "Servicios", movement_date: "2026-03-20", reference: "TKT-006" },
];

export default function SeedDemo() {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const runSeed = async () => {
    setStatus("running");
    setLog([]);
    setError(null);

    try {
      // 1. Categories
      addLog("Creando categorías...");
      const catRecords = await base44.entities.Category.bulkCreate(categories);
      const catMap = {};
      catRecords.forEach(c => { catMap[c.name] = c.id; });
      addLog(`✅ ${catRecords.length} categorías creadas`);

      // 2. Suppliers
      addLog("Creando proveedores...");
      const supRecords = await base44.entities.Supplier.bulkCreate(suppliers);
      const supMap = {};
      supRecords.forEach(s => { supMap[s.name] = s.id; });
      addLog(`✅ ${supRecords.length} proveedores creados`);

      // 3. Clients
      addLog("Creando clientes...");
      const cliRecords = await base44.entities.Client.bulkCreate(clients);
      const cliMap = {};
      cliRecords.forEach(c => { cliMap[c.name] = c.id; });
      addLog(`✅ ${cliRecords.length} clientes creados`);

      // 4. Products
      addLog("Creando productos...");
      const products = [
        { name: "Martillo de Uña 16 oz", sku: "HTM-001", description: "Martillo con mango de fibra de vidrio", category: catMap["Herramientas Manuales"], supplier: supMap["Truper Herramientas"], purchase_price: 85, sale_price: 145, stock: 42, min_stock: 10, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Desarmador de Cruz #2", sku: "DES-001", description: "Desarmador Phillips punta magnética", category: catMap["Herramientas Manuales"], supplier: supMap["Truper Herramientas"], purchase_price: 28, sale_price: 55, stock: 80, min_stock: 20, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Juego de Llaves Allen 9 pzas", sku: "LLA-001", description: "Llaves hexagonales métricas 1.5-10mm", category: catMap["Herramientas Manuales"], supplier: supMap["Truper Herramientas"], purchase_price: 65, sale_price: 120, stock: 35, min_stock: 10, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Pinzas de Presión 10\"", sku: "PIN-002", description: "Pinzas Vise-Grip mordaza curva", category: catMap["Herramientas Manuales"], supplier: supMap["Truper Herramientas"], purchase_price: 95, sale_price: 175, stock: 25, min_stock: 8, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Cinta Métrica 5m", sku: "CIN-001", description: "Flexómetro con freno automático", category: catMap["Herramientas Manuales"], supplier: supMap["Truper Herramientas"], purchase_price: 45, sale_price: 85, stock: 60, min_stock: 15, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Taladro Percutor DeWalt 1/2\"", sku: "TAL-001", description: "Taladro 20V Max brushless, incluye 2 baterías", category: catMap["Herramientas Eléctricas"], supplier: supMap["DeWalt México"], purchase_price: 2200, sale_price: 3499, stock: 8, min_stock: 3, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Esmeril Angular 4.5\" DeWalt", sku: "ESM-001", description: "Esmeriladora 4.5\" 900W 11000 RPM", category: catMap["Herramientas Eléctricas"], supplier: supMap["DeWalt México"], purchase_price: 980, sale_price: 1650, stock: 12, min_stock: 4, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Sierra Caladora Truper 650W", sku: "SIE-001", description: "Sierra caladora 650W 3000 CPM", category: catMap["Herramientas Eléctricas"], supplier: supMap["Truper Herramientas"], purchase_price: 650, sale_price: 1100, stock: 6, min_stock: 3, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Pijas Autorroscantes 6x1\" (caja 500)", sku: "PIJ-001", description: "Pijas punta broca cabeza phillips", category: catMap["Tornillería y Fijaciones"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 48, sale_price: 85, stock: 120, min_stock: 30, unit: "caja", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Taquetes Fisher 6mm (bolsa 100)", sku: "TAQ-001", description: "Taquetes nylon grises para concreto", category: catMap["Tornillería y Fijaciones"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 22, sale_price: 45, stock: 200, min_stock: 50, unit: "bolsa", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Tornillos Hexagonales 3/8\" (caja 100)", sku: "TOR-001", description: "Tornillos galvanizados con tuerca", category: catMap["Tornillería y Fijaciones"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 55, sale_price: 95, stock: 80, min_stock: 20, unit: "caja", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Tubo CPVC 1/2\" x 3m", sku: "TUB-001", description: "Tubo CPVC para agua caliente y fría", category: catMap["Plomería"], supplier: supMap["Distribuidora Nacobre"], purchase_price: 68, sale_price: 115, stock: 150, min_stock: 30, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Llave de Paso Esférica 1/2\" Latón", sku: "LLP-001", description: "Llave esférica latón con maneral", category: catMap["Plomería"], supplier: supMap["Distribuidora Nacobre"], purchase_price: 75, sale_price: 135, stock: 45, min_stock: 10, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Codo PVC 1/2\" 90° (bolsa 10)", sku: "COD-001", description: "Codos PVC presión para agua fría", category: catMap["Plomería"], supplier: supMap["Distribuidora Nacobre"], purchase_price: 18, sale_price: 35, stock: 300, min_stock: 60, unit: "bolsa", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Manguera de Abasto 1/2\" x 50cm", sku: "MAN-001", description: "Manguera trenzada acero inox para lavabo", category: catMap["Plomería"], supplier: supMap["Distribuidora Nacobre"], purchase_price: 32, sale_price: 65, stock: 90, min_stock: 20, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Cable THW Cal. 12 (rollo 100m)", sku: "CAB-001", description: "Cable eléctrico THW-LS negro 12 AWG", category: catMap["Electricidad"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 850, sale_price: 1350, stock: 20, min_stock: 5, unit: "rollo", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Contacto Doble Polarizado Bticino", sku: "CON-001", description: "Contacto doble con tierra física", category: catMap["Electricidad"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 38, sale_price: 72, stock: 110, min_stock: 25, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Interruptor Sencillo Bticino", sku: "INT-001", description: "Interruptor 10A 127V línea Magic", category: catMap["Electricidad"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 32, sale_price: 60, stock: 95, min_stock: 20, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Foco LED 10W E27 Luz Día", sku: "FOC-001", description: "Foco LED 10W 6500K equivale a 75W", category: catMap["Electricidad"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 28, sale_price: 52, stock: 3, min_stock: 30, unit: "pieza", tax_rate: 0, status: "active", business_id: BUSINESS_ID },
        { name: "Pintura Vinílica Comex 20L Blanco", sku: "PVC-001", description: "Pintura vinílica interior/exterior alta cubrición", category: catMap["Pinturas y Acabados"], supplier: supMap["Pinturas Comex"], purchase_price: 520, sale_price: 890, stock: 18, min_stock: 5, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Brocha Cerda Natural 4\"", sku: "BRO-001", description: "Brocha para acabados de madera y metal", category: catMap["Pinturas y Acabados"], supplier: supMap["Pinturas Comex"], purchase_price: 42, sale_price: 78, stock: 40, min_stock: 10, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Rodillo Antigoteo 9\" con Mango", sku: "ROD-001", description: "Rodillo de felpa para pintura vinílica", category: catMap["Pinturas y Acabados"], supplier: supMap["Pinturas Comex"], purchase_price: 55, sale_price: 98, stock: 30, min_stock: 8, unit: "pieza", tax_rate: 16, status: "active", business_id: BUSINESS_ID },
        { name: "Cemento Gris Moctezuma 50kg", sku: "CEM-001", description: "Cemento Portland CPC 30R resistente", category: catMap["Materiales de Construcción"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 185, sale_price: 245, stock: 2, min_stock: 20, unit: "pieza", tax_rate: 0, status: "active", business_id: BUSINESS_ID },
        { name: "Varilla Corrugada 3/8\" x 6m", sku: "VAR-001", description: "Varilla de acero corrugado grado 42", category: catMap["Materiales de Construcción"], supplier: supMap["Aceros y Materiales del Centro"], purchase_price: 88, sale_price: 145, stock: 4, min_stock: 15, unit: "pieza", tax_rate: 0, status: "active", business_id: BUSINESS_ID },
      ];
      const prodRecords = await base44.entities.Product.bulkCreate(products);
      addLog(`✅ ${prodRecords.length} productos creados`);

      // 5. Movements (inventario inicial)
      addLog("Registrando movimientos de inventario inicial...");
      const movements = prodRecords.map(p => ({
        product_id: p.id,
        product_name: p.name,
        type: "entry",
        quantity: p.stock,
        unit_price: p.purchase_price,
        total: p.stock * p.purchase_price,
        reason: "Inventario inicial de demostración",
        reference: "INV-INICIAL-001",
        stock_after: p.stock,
        business_id: BUSINESS_ID,
      }));
      const movRecords = await base44.entities.Movement.bulkCreate(movements);
      addLog(`✅ ${movRecords.length} movimientos registrados`);

      // 6. Petty Cash
      addLog("Registrando movimientos de caja chica...");
      const pcRecords = await base44.entities.PettyCashMovement.bulkCreate(pettyCash);
      addLog(`✅ ${pcRecords.length} movimientos de caja chica`);

      // 7. Quotations
      addLog("Creando cotizaciones...");
      const quotations = [
        {
          folio: "COT-2026-001",
          client_id: cliMap["Constructora Hernández e Hijos"],
          client_name: "Constructora Hernández e Hijos",
          client_email: "contacto@constructorahh.mx",
          client_phone: "449-555-1001",
          items: [
            { product_id: prodRecords[11]?.id, product_name: "Tubo CPVC 1/2\" x 3m", quantity: 50, unit_price: 115, total: 5750, tax_rate: 16 },
            { product_id: prodRecords[8]?.id, product_name: "Pijas Autorroscantes 6x1\"", quantity: 10, unit_price: 85, total: 850, tax_rate: 16 },
            { product_id: prodRecords[22]?.id, product_name: "Varilla Corrugada 3/8\"", quantity: 30, unit_price: 145, total: 4350, tax_rate: 0 },
          ],
          subtotal: 10950, tax: 1054, total: 12004,
          status: "accepted", payment_method: "Transferencia", in_route: false, delivered: false, paid: true,
          notes: "Entrega en obra los lunes y jueves", valid_until: "2026-03-31",
          business_id: BUSINESS_ID,
        },
        {
          folio: "COT-2026-002",
          client_id: cliMap["Hotel Boutique Casa Real"],
          client_name: "Hotel Boutique Casa Real",
          client_email: "compras@casareal.mx",
          client_phone: "449-555-4004",
          items: [
            { product_id: prodRecords[19]?.id, product_name: "Pintura Vinílica Comex 20L Blanco", quantity: 5, unit_price: 890, total: 4450, tax_rate: 16 },
            { product_id: prodRecords[20]?.id, product_name: "Brocha Cerda Natural 4\"", quantity: 10, unit_price: 78, total: 780, tax_rate: 16 },
            { product_id: prodRecords[21]?.id, product_name: "Rodillo Antigoteo 9\"", quantity: 8, unit_price: 98, total: 784, tax_rate: 16 },
          ],
          subtotal: 6014, tax: 962.24, total: 6976.24,
          status: "sent", payment_method: "Efectivo", in_route: false, delivered: false, paid: false,
          notes: "Remodelación habitaciones 101-120", valid_until: "2026-04-05",
          business_id: BUSINESS_ID,
        },
        {
          folio: "COT-2026-003",
          client_id: cliMap["Arq. Patricia Velarde"],
          client_name: "Arq. Patricia Velarde",
          client_email: "pvelarde.arq@gmail.com",
          client_phone: "449-555-3003",
          items: [
            { product_id: prodRecords[5]?.id, product_name: "Taladro Percutor DeWalt 1/2\"", quantity: 1, unit_price: 3499, total: 3499, tax_rate: 16 },
            { product_id: prodRecords[6]?.id, product_name: "Esmeril Angular 4.5\" DeWalt", quantity: 1, unit_price: 1650, total: 1650, tax_rate: 16 },
          ],
          subtotal: 5149, tax: 823.84, total: 5972.84,
          status: "converted", payment_method: "Tarjeta", in_route: true, delivered: false, paid: false,
          notes: "Obra en Fracc. Villa Jardín", valid_until: "2026-04-10",
          business_id: BUSINESS_ID,
        },
        {
          folio: "COT-2026-004",
          client_id: cliMap["Juan Carlos Ríos (Plomero)"],
          client_name: "Juan Carlos Ríos (Plomero)",
          client_email: "jcrios.plomero@hotmail.com",
          client_phone: "449-555-5005",
          items: [
            { product_id: prodRecords[11]?.id, product_name: "Tubo CPVC 1/2\"", quantity: 20, unit_price: 115, total: 2300, tax_rate: 16 },
            { product_id: prodRecords[12]?.id, product_name: "Llave de Paso Esférica 1/2\"", quantity: 5, unit_price: 135, total: 675, tax_rate: 16 },
            { product_id: prodRecords[13]?.id, product_name: "Codo PVC 1/2\" 90°", quantity: 10, unit_price: 35, total: 350, tax_rate: 16 },
          ],
          subtotal: 3325, tax: 532, total: 3857,
          status: "draft", payment_method: "Efectivo", in_route: false, delivered: false, paid: false,
          notes: "", valid_until: "2026-04-01",
          business_id: BUSINESS_ID,
        },
      ];
      const quotRecords = await base44.entities.Quotation.bulkCreate(quotations);
      addLog(`✅ ${quotRecords.length} cotizaciones creadas`);

      addLog("🎉 ¡Demo cargada exitosamente!");
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            Cargar Datos de Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esto poblará la base de datos con productos, categorías, proveedores, clientes, movimientos, caja chica y cotizaciones de demostración para <strong>Ferretería El Clavo</strong>.
          </p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Solo ejecutar una vez. Si ya tienes datos, se duplicarán.
          </p>

          {status === "idle" && (
            <Button onClick={runSeed} className="w-full">
              Cargar datos de demo
            </Button>
          )}

          {status === "running" && (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Cargando...
            </Button>
          )}

          {status === "done" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Datos de demo cargados correctamente</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {log.length > 0 && (
            <div className="bg-muted rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto">
              {log.map((line, i) => (
                <p key={i} className="text-xs font-mono text-foreground">{line}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}