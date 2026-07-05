import React from "react";

const LOGO_URL = "https://media.base44.com/images/public/69af971d0fdb362c9ae52ed3/5032b5555_StockFlow_logo.png";
const APP_NAME = "StockFlow";

/**
 * Split-panel auth layout shell.
 * Left: form area (~60%). Right: visual brand panel (hidden on mobile).
 */
export default function AuthLayout({ title, subtitle, footer, children, showSplitPanel = true }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* ── LEFT PANEL: form ── */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:w-[60%] lg:flex-none lg:px-20 xl:px-28">
        {/* Top-left branding */}
        <div className="mb-10 flex items-center gap-2.5">
          <img src={LOGO_URL} alt={APP_NAME} className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold tracking-tight text-foreground">{APP_NAME}</span>
        </div>

        {/* Heading block */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Form content */}
        <div className="w-full max-w-sm">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <p className="mt-8 text-sm text-muted-foreground">{footer}</p>
        )}
      </div>

      {/* ── RIGHT PANEL: visual ── */}
      {showSplitPanel && (
        <div className="relative hidden lg:flex lg:w-[40%] items-center justify-center overflow-hidden
          bg-gradient-to-br from-slate-100 via-blue-50 to-brand-100
          dark:from-slate-900 dark:via-blue-950 dark:to-brand-950">
          {/* Blurred depth circles */}
          <div className="absolute top-1/4 left-1/4 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-700/30" />
          <div className="absolute bottom-1/4 right-1/4 h-56 w-56 translate-x-1/2 translate-y-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-700/25" />

          {/* Centered content */}
          <div className="relative z-10 flex flex-col items-center gap-6 px-10 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/80 shadow-xl backdrop-blur-sm dark:bg-white/10">
              <img src={LOGO_URL} alt={APP_NAME} className="h-14 w-14 object-contain" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Control de inventario<br />sin complicaciones
            </h2>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Gestiona productos, cotizaciones, movimientos y caja chica en un solo lugar, desde cualquier dispositivo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}