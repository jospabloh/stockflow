import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// Nombres completos en español — moment() no tiene locale "es" cargado en esta
// app (formatear con "MMMM" da nombres en inglés), así que se listan a mano.
export const MONTH_LABELS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatMonthYearEs(momentValue) {
  return momentValue.isValid() ? `${MONTH_LABELS_FULL[momentValue.month()]} ${momentValue.year()}` : "";
}

/**
 * MonthYearPicker — selector de mes/año en un solo control: navega el año con
 * las flechas y elige el mes en una cuadrícula, en vez de depender del picker
 * nativo del navegador para <input type="month"> (inconsistente entre
 * Chrome/Safari/Firefox y poco legible en móvil).
 *
 * value    — string "YYYY-MM"
 * onChange — fn(newValue: "YYYY-MM")
 */
export default function MonthYearPicker({ value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const selected = moment(value, "YYYY-MM");
  const [viewYear, setViewYear] = useState(selected.isValid() ? selected.year() : moment().year());
  const containerRef = useRef(null);

  useEffect(() => {
    if (selected.isValid()) setViewYear(selected.year());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectMonth = (monthIdx) => {
    onChange(moment({ year: viewYear, month: monthIdx }).format("YYYY-MM"));
    setOpen(false);
  };

  const today = moment();
  const label = selected.isValid() ? formatMonthYearEs(selected) : "Elegir mes";

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md bg-background hover:border-brand-300 transition-colors"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Navegación de año */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Año anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground font-mono tabular-nums">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Año siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Cuadrícula de meses */}
          <div className="grid grid-cols-4 gap-1.5 p-3">
            {MONTH_LABELS.map((label, idx) => {
              const isSelected = selected.isValid() && selected.year() === viewYear && selected.month() === idx;
              const isCurrent = today.year() === viewYear && today.month() === idx;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectMonth(idx)}
                  className={cn(
                    "relative text-xs font-medium py-2 rounded-lg transition-colors",
                    isSelected
                      ? "bg-brand-600 text-white"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {label}
                  {isCurrent && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-500" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Atajo a mes actual */}
          <div className="px-3 py-2 border-t border-border">
            <button
              type="button"
              onClick={() => { setViewYear(today.year()); onChange(today.format("YYYY-MM")); setOpen(false); }}
              className="text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              Ir a mes actual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
