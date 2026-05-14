import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Upload, CheckCircle2, AlertCircle, FileText, X, Package, Users, Tag } from "lucide-react";
import { toast } from "sonner";

// ─── Configuración por tipo de importación ───────────────────────────────────

const IMPORT_TYPES = {
  products: {
    label: "Productos",
    icon: Package,
    color: "indigo",
    headers: ["nombre","sku","codigo_barras","descripcion","precio_compra","precio_menudeo","precio_mayoreo","stock","stock_minimo","unidad","categoria"],
    sampleRows: [
      "Producto Ejemplo,SKU001,7501234567890,Descripción del producto,50.00,100.00,80.00,25,5,pieza,Electrónica",
      "Otro Producto,SKU002,,Sin descripción,0,200.00,0,10,2,caja,",
    ],
    hint: 'La columna "categoria" es opcional. Si se indica, debe existir en Configuración → Categorías.',
    hintExtra: 'Unidades válidas: pieza, kg, litro, metro, caja, paquete. La cantidad mínima para mayoreo se configura en la Categoría, no en el producto.',
    previewColumns: [
      { key: "name", label: "Nombre" },
      { key: "sku", label: "SKU" },
      { key: "retail_sale_price", label: "P. Menudeo", format: "currency" },
      { key: "wholesale_sale_price", label: "P. Mayoreo", format: "currency" },
      { key: "stock", label: "Stock", format: "number" },
      { key: "unit", label: "Unidad" },
    ],
  },
  clients: {
    label: "Clientes",
    icon: Users,
    color: "emerald",
    headers: ["nombre","nombre_negocio","giro","telefono","email","direccion","force_wholesale_all_products","force_purchase_all_products"],
    sampleRows: [
      "Juan Pérez,Ferretería Pérez,Ferretería,449-123-4567,juan@email.com,Av. Principal 100,false,false",
      "Distribuidora XYZ,,Distribución,449-987-6543,contacto@xyz.com,Calle 5 #200,true,false",
    ],
    hint: 'Los campos "force_wholesale_all_products" y "force_purchase_all_products" aceptan: true/false, 1/0, sí/no. No pueden estar ambos en true.',
    hintExtra: 'Los campos "nombre_negocio" y "giro" son opcionales.',
    previewColumns: [
      { key: "name", label: "Nombre" },
      { key: "business_name", label: "Nombre Negocio" },
      { key: "giro", label: "Giro" },
      { key: "phone", label: "Teléfono" },
      { key: "email", label: "Email" },
      { key: "force_wholesale_all_products", label: "Precio Mayoreo", format: "bool" },
    ],
  },
  categories: {
    label: "Categorías",
    icon: Tag,
    color: "violet",
    headers: ["nombre","descripcion","cantidad_minima_mayoreo"],
    sampleRows: [
      "Electrónica,Productos electrónicos y accesorios,10",
      "Herramientas,Herramientas manuales y eléctricas,",
    ],
    hint: 'Solo se requiere el nombre. La descripción y cantidad_minima_mayoreo son opcionales.',
    hintExtra: '"cantidad_minima_mayoreo": si el total de productos de esta categoría en una cotización alcanza este número, se aplica precio mayoreo automáticamente.',
    previewColumns: [
      { key: "name", label: "Nombre" },
      { key: "description", label: "Descripción" },
      { key: "wholesale_min_qty", label: "Mín. Mayoreo", format: "number" },
    ],
  },
};

// ─── Parsers ─────────────────────────────────────────────────────────────────

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

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(s)) return true;
  return false;
}

function rowToProduct(row) {
  const VALID_UNITS = ["pieza", "kg", "litro", "metro", "caja", "paquete"];
  const unit = VALID_UNITS.includes((row["unidad"] || "").toLowerCase()) ? row["unidad"].toLowerCase() : "pieza";
  return {
    name: (row["nombre"] || row["name"] || "").trim(),
    sku: (row["sku"] || "").trim(),
    barcode: (row["codigo_barras"] || row["barcode"] || "").trim(),
    description: (row["descripcion"] || "").trim(),
    purchase_price: parseFloat(row["precio_compra"] || "0") || 0,
    retail_sale_price: parseFloat(row["precio_menudeo"] || row["precio_venta"] || "0") || 0,
    wholesale_sale_price: parseFloat(row["precio_mayoreo"] || "0") || 0,
    stock: parseFloat(row["stock"] || "0") || 0,
    min_stock: parseFloat(row["stock_minimo"] || "5") || 5,
    unit,
    categoria: (row["categoria"] || "").trim(),
    _raw: row,
  };
}

function rowToClient(row) {
  return {
    name: (row["nombre"] || row["name"] || "").trim(),
    business_name: (row["nombre_negocio"] || "").trim(),
    giro: (row["giro"] || "").trim(),
    phone: (row["telefono"] || "").trim(),
    email: (row["email"] || "").trim(),
    address: (row["direccion"] || "").trim(),
    force_wholesale_all_products: parseBool(row["force_wholesale_all_products"]),
    force_purchase_all_products: parseBool(row["force_purchase_all_products"]),
    _raw: row,
  };
}

function rowToCategory(row) {
  const minQtyRaw = (row["cantidad_minima_mayoreo"] || "").trim();
  const minQty = minQtyRaw !== "" ? parseFloat(minQtyRaw) : null;
  return {
    name: (row["nombre"] || row["name"] || "").trim(),
    description: (row["descripcion"] || "").trim(),
    wholesale_min_qty: minQty != null && !isNaN(minQty) && minQty >= 0 ? minQty : null,
    _raw: row,
  };
}

function parseRows(text, type) {
  const raw = parseCSV(text);
  if (type === "products") return raw.map(rowToProduct);
  if (type === "clients") return raw.map(rowToClient);
  if (type === "categories") return raw.map(rowToCategory);
  return [];
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtValue(val, format) {
  if (format === "currency") return `$${(val || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  if (format === "number") return String(val ?? "—");
  if (format === "bool") return val ? "✓ Sí" : "No";
  return val || "—";
}

// ─── Colores por tipo ─────────────────────────────────────────────────────────

const COLOR_MAP = {
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800",
    badge: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700",
    title: "text-indigo-700 dark:text-indigo-300",
    hint: "text-indigo-600 dark:text-indigo-400",
    hintBg: "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800",
    btn: "bg-indigo-600 hover:bg-indigo-700",
    step: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
    stepCard: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700",
    title: "text-emerald-700 dark:text-emerald-300",
    hint: "text-emerald-600 dark:text-emerald-400",
    hintBg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
    btn: "bg-emerald-600 hover:bg-emerald-700",
    step: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
    stepCard: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    badge: "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700",
    title: "text-violet-700 dark:text-violet-300",
    hint: "text-violet-600 dark:text-violet-400",
    hintBg: "bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800",
    btn: "bg-violet-600 hover:bg-violet-700",
    step: "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300",
    stepCard: "bg-violet-50 dark:bg-violet-950/30",
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ImportProducts() {
  const [activeType, setActiveType] = useState("products");
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const config = IMPORT_TYPES[activeType];
  const colors = COLOR_MAP[config.color];

  const handleTypeChange = (type) => {
    setActiveType(type);
    setPreview(null);
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const csv = [config.headers.join(","), ...config.sampleRows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla_${activeType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseRows(ev.target.result, activeType);
      setPreview(rows);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setImporting(true);
    try {
      // Send raw row data to backend for secure processing
      const rawRows = preview.map(p => p._raw);
      const response = await base44.functions.invoke('importItemsSafe', {
        import_type: activeType,
        rows: rawRows,
      });
      const data = response.data;
      if (!data.success) {
        toast.error(data.error || "Error en la importación");
        setImporting(false);
        return;
      }
      setResults(data);
      setPreview(null);
      toast.success(`Importación completada: ${data.successCount} registros creados${data.errorCount > 0 ? `, ${data.errorCount} con error` : ""}`);
    } catch (err) {
      toast.error(`Error al importar: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm p-6 space-y-6">
      <div>
        <h3 className="font-semibold text-foreground text-lg">Importación Masiva</h3>
        <p className="text-sm text-muted-foreground mt-1">Carga múltiples registros desde un archivo CSV</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(IMPORT_TYPES).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const c = COLOR_MAP[cfg.color];
          const isActive = activeType === key;
          return (
            <button type="button"
              key={key}
              onClick={() => handleTypeChange(key)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium
                ${isActive
                  ? `${c.bg} ${c.border} ${c.title}`
                  : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted"
                }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? c.title : "text-muted-foreground"}`} />
              <span className="text-xs">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${colors.stepCard} rounded-xl p-4 text-center space-y-2`}>
          <div className={`h-10 w-10 rounded-full ${colors.step} flex items-center justify-center mx-auto`}>
            <span className="font-bold text-sm">1</span>
          </div>
          <p className="text-sm font-medium text-foreground">Descarga la plantilla</p>
          <p className="text-xs text-muted-foreground">Formato CSV con las columnas correctas</p>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-1" /> Descargar plantilla
          </Button>
        </div>
        <div className="bg-muted/30 rounded-xl p-4 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <span className="text-muted-foreground font-bold text-sm">2</span>
          </div>
          <p className="text-sm font-medium text-foreground">Llena con tus datos</p>
          <p className="text-xs text-muted-foreground">Abre en Excel, llena y guarda como CSV</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-4 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <span className="text-muted-foreground font-bold text-sm">3</span>
          </div>
          <p className="text-sm font-medium text-foreground">Sube el archivo</p>
          <p className="text-xs text-muted-foreground">Revisa la vista previa y confirma</p>
          <Button size="sm" onClick={() => fileRef.current?.click()} className={`w-full ${colors.btn} text-white`}>
            <Upload className="h-4 w-4 mr-1" /> Subir CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Column reference */}
      <div className={`${colors.hintBg} rounded-xl p-4 space-y-2`}>
        <p className={`text-xs font-semibold ${colors.title} mb-2`}>
          Columnas de la plantilla — {config.label}:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {config.headers.map(h => (
            <span key={h} className={`text-xs px-2 py-1 rounded-md font-mono font-medium ${colors.badge}`}>
              {h}
            </span>
          ))}
        </div>
        {config.hint && (
          <p className={`text-xs ${colors.hint} mt-2`}>ℹ️ {config.hint}</p>
        )}
        {config.hintExtra && (
          <p className={`text-xs ${colors.hint}`}>ℹ️ {config.hintExtra}</p>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 flex items-center gap-3 ${results.errorCount === 0 ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"}`}>
            {results.errorCount === 0
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              : <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            }
            <div>
              <p className="text-sm font-medium text-foreground">
                {results.successCount} {config.label.toLowerCase()} importados correctamente
                {results.errorCount > 0 && `, ${results.errorCount} con error`}
              </p>
              <p className="text-xs text-muted-foreground">Los registros válidos ya están disponibles en el sistema</p>
            </div>
          </div>
          {results.results?.filter(r => r.status === 'error').map((r, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">
                <span className="font-semibold">Fila {r.row}{r.nombre ? ` — ${r.nombre}` : ""}:</span> {r.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className={`h-5 w-5 ${colors.title}`} />
              <p className="font-medium text-foreground">{preview.length} {config.label.toLowerCase()} listos para importar</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {config.previewColumns.map(col => (
                    <TableHead key={col.key} className="text-xs text-foreground font-semibold">{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i} className={!row.name ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    {config.previewColumns.map(col => (
                      <TableCell key={col.key} className="text-xs text-foreground">
                        {!row.name && col.key === "name"
                          ? <span className="text-red-500 font-medium">Sin nombre</span>
                          : fmtValue(row[col.key], col.format)
                        }
                      </TableCell>
                    ))}
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
              className={`${colors.btn} text-white`}
            >
              {importing ? (
                <><span className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Importando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-1" />Importar {preview.length} {config.label.toLowerCase()}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}