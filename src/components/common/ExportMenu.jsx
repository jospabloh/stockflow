import { useState } from "react";
import { Download, ChevronDown, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { exportData } from "@/lib/exportData";

const FORMAT_META = {
  csv: { label: "CSV (.csv)", icon: FileText },
  xlsx: { label: "Excel (.xlsx)", icon: FileSpreadsheet },
  pdf: { label: "PDF (.pdf)", icon: FileType },
};

/**
 * Botón "Descargar" con menú desplegable para exportar datos tabulares en
 * CSV / XLSX / PDF usando la utilidad compartida `exportData`.
 *
 * Props:
 *   columns, rows  -> forma normalizada ({ key, label, type? } y filas)
 *   getData        -> alternativa: () => ({ columns, rows, filename?, title?, orientation? })
 *                     útil cuando las columnas/filas se calculan en tiempo de click
 *                     (p. ej. tablas pivote con columnas dinámicas)
 *   filename       -> nombre base sin extensión
 *   title          -> encabezado del PDF / nombre de hoja (por defecto, filename)
 *   orientation    -> 'portrait' | 'landscape' (por defecto, auto según nº de columnas)
 *   formats        -> formatos a mostrar (por defecto ['csv','xlsx','pdf'])
 *   label          -> texto del botón (por defecto "Descargar")
 *   variant, size  -> reenviados a Button
 */
export default function ExportMenu({
  columns,
  rows,
  getData,
  filename,
  title,
  orientation,
  formats = ["csv", "xlsx", "pdf"],
  label = "Descargar",
  variant = "outline",
  size = "sm",
  className,
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);

  const handleExport = async (format) => {
    if (busy) return;
    setBusy(true);
    try {
      const resolved = typeof getData === "function" ? getData() : null;
      const payload = {
        columns: resolved?.columns ?? columns,
        rows: resolved?.rows ?? rows,
        filename: resolved?.filename ?? filename,
        title: resolved?.title ?? title,
        orientation: resolved?.orientation ?? orientation,
      };
      await exportData(format, payload);
    } catch (error) {
      toast.error(`Error al exportar: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={disabled || busy}>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => {
          const meta = FORMAT_META[format];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <DropdownMenuItem key={format} onSelect={() => handleExport(format)} disabled={busy}>
              <Icon className="h-4 w-4" />
              {meta.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
