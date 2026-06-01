import React, { useState, useRef, useEffect } from "react";
import { Filter, Search, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ColumnFilterPopover — filtro tipo Excel por columna.
 * Soporta: multi-selección, búsqueda interna, rango de fechas y búsqueda de texto.
 *
 * Props:
 *  label         — texto del encabezado de columna
 *  type          — "multiselect" | "daterange" | "search"
 *  options       — array de { value, label } (solo multiselect)
 *  selected      — Set (multiselect) | { from, to } (daterange) | string (search)
 *  onChange      — fn(newSelected) → callback al padre
 *  className     — clases adicionales al trigger
 */
export default function ColumnFilterPopover({ label, type = "multiselect", options = [], selected, onChange, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const isMulti = type === "multiselect";
  const isDate = type === "daterange";
  const isSearch = type === "search";

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ¿Hay filtros activos?
  const hasActive = isMulti
    ? selected instanceof Set && selected.size > 0
    : isDate
      ? !!(selected?.from || selected?.to)
      : isSearch
        ? !!(selected && selected.trim())
        : false;

  const filtered = isMulti
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : [];

  const toggleOption = (val) => {
    const next = new Set(selected);
    next.has(val) ? next.delete(val) : next.add(val);
    onChange(next);
  };

  const clearAll = (e) => {
    e.stopPropagation();
    if (isMulti) onChange(new Set());
    else if (isDate) onChange({ from: "", to: "" });
    else onChange("");
  };

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold transition-colors rounded px-1 py-0.5",
          hasActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span>{label}</span>
        {hasActive ? (
          <span className="flex items-center gap-0.5">
            <Filter className="h-3 w-3 fill-indigo-500 text-indigo-500" />
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full hover:bg-red-100 text-red-500 p-0.5"
              title="Limpiar filtro"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ) : (
          <ChevronDown className="h-3 w-3 opacity-50" />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Header del popover */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{label}</span>
            {hasActive && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          {/* Multi-select */}
          {isMulti && (
            <>
              {/* Búsqueda interna */}
              {options.length > 5 && (
                <div className="px-3 py-1.5 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-xs bg-muted rounded-md outline-none"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Opciones */}
              <div className="max-h-52 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-3 text-center">Sin opciones</p>
                )}
                {filtered.map(opt => {
                  const isChecked = selected instanceof Set && selected.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleOption(opt.value)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors",
                        isChecked && "bg-indigo-50 dark:bg-indigo-950/30"
                      )}
                    >
                      <span className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                        isChecked ? "bg-indigo-600 border-indigo-600" : "border-border bg-background"
                      )}>
                        {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      {opt.color && (
                        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", opt.color)} />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Footer con conteo */}
              {selected instanceof Set && selected.size > 0 && (
                <div className="px-3 py-2 border-t border-border bg-muted/40">
                  <span className="text-[10px] text-muted-foreground">
                    {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Date range */}
          {isDate && (
            <div className="px-3 py-3 space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Desde</label>
                <input
                  type="date"
                  value={selected?.from || ""}
                  onChange={e => onChange({ ...selected, from: e.target.value })}
                  className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Hasta</label>
                <input
                  type="date"
                  value={selected?.to || ""}
                  onChange={e => onChange({ ...selected, to: e.target.value })}
                  className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>
          )}

          {/* Search text */}
          {isSearch && (
            <div className="px-3 py-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  value={selected || ""}
                  onChange={e => onChange(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 text-xs border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}