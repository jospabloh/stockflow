import React from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, AlertTriangle } from "lucide-react";
import { createPageUrl } from "@/utils";

/**
 * Signature hero — "Inventario en vivo".
 *
 * Leads the dashboard with the most characteristic thing in a stock app: how
 * many units are on the shelves right now, the day's entrada/salida flow, and
 * what needs restocking. Grounded in the warehouse vernacular (unidades, flujo,
 * reponer) and built on the brand type system (Space Grotesk eyebrow, IBM Plex
 * Mono figures). This is the one bold surface; everything below it stays quiet.
 */
export default function InventoryPulse({
  totalStock = 0,
  activeCount = 0,
  totalValue = 0,
  todayEntries = 0,
  todayExits = 0,
  lowStockCount = 0,
  showValue = true,
}) {
  const flow = todayEntries + todayExits;
  const entriesPct = flow > 0 ? (todayEntries / flow) * 100 : 0;
  const exitsPct = flow > 0 ? (todayExits / flow) * 100 : 0;

  const fmtInt = (n) => Number(n || 0).toLocaleString("es-MX");
  const fmtMoney = (n) =>
    `$${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

  return (
    <section
      aria-label="Inventario en vivo"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
    >
      {/* Stacking-box motif, echoing the brand loader — quiet ambient texture */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 hidden sm:flex items-end gap-2 opacity-20">
        {[44, 64, 52, 80, 60].map((h, i) => (
          <span
            key={i}
            className="w-7 rounded-md bg-white animate-box-stack"
            style={{ height: h, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <div className="relative grid gap-6 p-6 md:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {/* Left: the inventory thesis — units on the shelves right now */}
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Inventario en vivo
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono tabular text-5xl md:text-6xl font-semibold leading-none tracking-tight">
              {fmtInt(totalStock)}
            </span>
            <span className="text-sm font-medium text-white/80">unidades en stock</span>
          </div>
          <p className="mt-3 text-sm text-white/80">
            <span className="font-mono tabular font-medium text-white">{fmtInt(activeCount)}</span> productos activos
            {showValue && (
              <>
                <span className="mx-2 text-white/40">·</span>
                <span className="font-mono tabular font-medium text-white">{fmtMoney(totalValue)}</span> al costo
              </>
            )}
          </p>

          {lowStockCount > 0 && (
            <Link
              to={createPageUrl("Products") + "?filter=low_stock"}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
              </span>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {fmtInt(lowStockCount)} {lowStockCount === 1 ? "producto por reponer" : "productos por reponer"}
            </Link>
          )}
        </div>

        {/* Right: today's flow — entradas vs salidas, encoded as a proportion bar */}
        <div className="rounded-xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Flujo de hoy
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono tabular text-xl font-semibold leading-none">{fmtInt(todayEntries)}</p>
                <p className="text-[11px] text-white/70">entradas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono tabular text-xl font-semibold leading-none">{fmtInt(todayExits)}</p>
                <p className="text-[11px] text-white/70">salidas</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {flow > 0 ? (
              <div
                className="flex h-2 overflow-hidden rounded-full bg-white/20"
                role="img"
                aria-label={`${todayEntries} entradas y ${todayExits} salidas hoy`}
              >
                <div className="bg-white/90 transition-all" style={{ width: `${entriesPct}%` }} />
                <div className="bg-cyan-200 transition-all" style={{ width: `${exitsPct}%` }} />
              </div>
            ) : (
              <p className="text-xs text-white/70">Aún no hay movimientos hoy.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
