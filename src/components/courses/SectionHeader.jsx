import React from "react";

// Encabezado de sección de Cursos, con el gradiente de marca (indigo→cyan) —
// la firma visual que amarra todas las páginas del módulo con el resto de la app.
export default function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-lg shadow-brand-500/20 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
