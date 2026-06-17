import * as React from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spinner de marca con tema de inventario: tres "cajas" que se apilan/rebotan
 * en secuencia, en color primary. Reemplaza los Loader2/animate-spin ad-hoc.
 *
 * Variantes:
 *  - <Spinner />            loader inline (sm | md | lg)
 *  - <LoadingOverlay show /> capa sobre un contenedor relative (durante refetch)
 *  - <FullPageLoader />     loader centrado a pantalla completa
 */

const SIZES = {
  sm: { box: "h-1.5 w-1.5", gap: "gap-[3px]", text: "text-xs" },
  md: { box: "h-2.5 w-2.5", gap: "gap-1", text: "text-sm" },
  lg: { box: "h-3.5 w-3.5", gap: "gap-1.5", text: "text-base" },
};

export function Spinner({ size = "md", label, className }) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "Cargando"}
      className={cn("inline-flex items-center", label ? "gap-2.5" : "", className)}
    >
      <span className={cn("inline-flex items-end", s.gap)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "rounded-[2px] bg-primary will-change-transform animate-box-stack",
              s.box
            )}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {label ? (
        <span className={cn("text-muted-foreground", s.text)}>{label}</span>
      ) : (
        <span className="sr-only">{label || "Cargando"}</span>
      )}
    </div>
  );
}

/**
 * Capa de carga para mostrar durante un refetch en background. Montar dentro de
 * un contenedor con `position: relative`. No bloquea el scroll de la página.
 */
export function LoadingOverlay({ show = true, label = "Actualizando…", className }) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center",
        "bg-background/60 backdrop-blur-[1px] rounded-[inherit]",
        "animate-in fade-in-0",
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card/90 px-6 py-4 shadow-lg">
        <Spinner size="lg" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/** Loader centrado a pantalla completa (carga inicial de páginas/rutas). */
export function FullPageLoader({ label = "Cargando…", className }) {
  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center gap-4 bg-background",
        className
      )}
    >
      <div className="relative">
        <Package className="h-10 w-10 text-primary/30" strokeWidth={1.5} />
      </div>
      <Spinner size="lg" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default Spinner;
