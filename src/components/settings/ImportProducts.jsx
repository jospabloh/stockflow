import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Upload, CheckCircle2, AlertCircle, FileText, X } from "lucide-react";
import { toast } from "sonner";

const TEMPLATE_HEADERS = ["nombre", "sku", "codigo_barras", "descripcion", "precio_compra", "precio_venta", "stock", "stock_minimo", "unidad"];
const UNITS = ["pieza", "kg", "litro", "metro", "caja", "paquete"];

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].replace(/\r/g, "").split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.replace(/\r/g, "").split(",");
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || "").trim(); });
    return obj;
  }).filter(row => row["nombre"] || row["name"]);
}

function rowToProduct(row) {
  const name = row["nombre"] || row["name"] || "";
  const unit = UNITS.includes(row["unidad"]) ? row["unidad"] : "pieza";
  return {
    name,
    sku: row["sku"] || "",
    barcode: row["codigo_barras"] || row["barcode"] || "",
    description: row["descripcion"] || row["description"] || "",
    purchase_price: parseFloat(row["precio_compra"] || row["purchase_price"] || "0") || 0,
    sale_price: parseFloat(row["precio_venta"] || row["sale_price"] || "0") || 0,
    stock: parseFloat(row["stock"] || "0") || 0,
    min_stock: parseFloat(row["stock_minimo"] || row["min_stock"] || "5") || 5,
    unit,
    status: "active",
  };
}

export default function ImportProducts() {
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const downloadTemplate = () => {
    const csv = [
      TEMPLATE_HEADERS.join(","),
      "Producto Ejemplo,SKU001,7501234567890,Descripción del producto,50.00,100.00,25,5,pieza",
      "Otro Producto,SKU002,,Sin descripción,0,200.00,10,2,caja",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const products = rows.map(rowToProduct);
      setPreview(products);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setImporting(true);
    let success = 0, errors = 0;
    for (const product of preview) {
      try {
        const created = await base44.entities.Product.create(product);
        // BUG-030: Registrar stock inicial como movimiento
        if (product.stock > 0 && created?.id) {
          await base44.entities.Movement.create({
            product_id: created.id,
            product_name: product.name,
            type: "entry",
            quantity: product.stock,
            unit_price: product.purchase_price || 0,
            total: product.stock * (product.purchase_price || 0),
            reason: "Stock inicial",
            reference: "Importación CSV",
            stock_after: product.stock,
          });
        }
        success++;
      } catch {
        errors++;
      }
    }
    setImporting(false);
    setResults({ success, errors });
    setPreview(null);
    toast.success(`Importación completada: ${success} productos creados${errors > 0 ? `, ${errors} con error` : ""}`);
  };

  return (
    <Card className="border-0 shadow-sm p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-700 text-lg">Importar Inventario Inicial</h3>
          <p className="text-sm text-slate-500 mt-1">Carga masiva de productos desde un archivo CSV o Excel exportado como CSV</p>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
            <span className="text-indigo-700 font-bold text-sm">1</span>
          </div>
          <p className="text-sm font-medium text-slate-700">Descarga la plantilla</p>
          <p className="text-xs text-slate-500">Formato CSV con las columnas correctas</p>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-1" /> Descargar plantilla
          </Button>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
            <span className="text-slate-600 font-bold text-sm">2</span>
          </div>
          <p className="text-sm font-medium text-slate-700">Llena con tus datos</p>
          <p className="text-xs text-slate-500">Abre en Excel, llena y guarda como CSV</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
            <span className="text-slate-600 font-bold text-sm">3</span>
          </div>
          <p className="text-sm font-medium text-slate-700">Sube el archivo</p>
          <p className="text-xs text-slate-500">Revisa la vista previa y confirma</p>
          <Button size="sm" onClick={() => fileRef.current?.click()} className="w-full bg-indigo-600 hover:bg-indigo-700">
            <Upload className="h-4 w-4 mr-1" /> Subir CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Column reference */}
      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2">Columnas de la plantilla:</p>
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_HEADERS.map(h => (
            <Badge key={h} variant="outline" className="text-xs bg-white">{h}</Badge>
          ))}
        </div>
        <p className="text-xs text-amber-700 mt-2">La unidad puede ser: pieza, kg, litro, metro, caja, paquete</p>
      </div>

      {/* Results */}
      {results && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${results.errors === 0 ? "bg-emerald-50" : "bg-amber-50"}`}>
          {results.errors === 0
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            : <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          }
          <div>
            <p className="text-sm font-medium text-slate-700">
              {results.success} productos importados correctamente
              {results.errors > 0 && `, ${results.errors} con error`}
            </p>
            <p className="text-xs text-slate-500">Los productos ya están disponibles en el inventario</p>
          </div>
        </div>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <p className="font-medium text-slate-700">{preview.length} productos listos para importar</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </div>

          <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Código barras</TableHead>
                  <TableHead className="text-xs text-right">Precio venta</TableHead>
                  <TableHead className="text-xs text-right">Stock</TableHead>
                  <TableHead className="text-xs">Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((p, i) => (
                  <TableRow key={i} className={!p.name ? "bg-red-50" : ""}>
                    <TableCell className="text-sm font-medium">{p.name || <span className="text-red-500">Sin nombre</span>}</TableCell>
                    <TableCell className="text-xs text-slate-500">{p.sku || "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{p.barcode || "—"}</TableCell>
                    <TableCell className="text-xs text-right">${p.sale_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-xs text-right">{p.stock}</TableCell>
                    <TableCell className="text-xs">{p.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {importing ? (
                <><span className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Importando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-1" />Importar {preview.length} productos</>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}