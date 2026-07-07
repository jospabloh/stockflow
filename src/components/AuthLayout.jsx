import React from "react";

const LOGO_URL = "https://media.base44.com/images/public/69af971d0fdb362c9ae52ed3/5032b5555_StockFlow_logo.png";
const APP_NAME = "StockFlow";

// Layout de marca para las pantallas de autenticación. Dos columnas en
// desktop: el formulario a la izquierda y un panel de marca StockFlow a la
// derecha (oculto en móvil). Mismo esqueleto que el resto del portafolio
// ACACIA (ver rumbo/src/components/AuthLayout.jsx): badge de ícono + título +
// children + footer a la izquierda, panel degradado con pill badge + headline
// a la derecha — con la identidad visual y el copy propios de StockFlow.
export default function AuthLayout({ icon: Icon, title, subtitle = null, footer = null, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-2">
      {/* Columna del formulario */}
      <div className="flex min-h-screen flex-col px-6 py-8 lg:min-h-0 lg:px-12">
        <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <img src={LOGO_URL} alt={APP_NAME} className="h-9 w-9 object-contain" />
          {APP_NAME}
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-7 text-center">
            {Icon && (
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
        </div>

        <p className="text-center text-xs text-muted-foreground">StockFlow · Control de inventario</p>
      </div>

      {/* Panel de marca (desktop) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/25 via-primary/5 to-background lg:block">
        <div className="absolute inset-0 flex flex-col justify-center px-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            Gestión de inventario
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-tight">
            Control de inventario
            <br />
            <span className="text-primary">sin complicaciones</span>.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Productos, cotizaciones, movimientos y caja chica en un solo lugar,
            desde cualquier dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}
