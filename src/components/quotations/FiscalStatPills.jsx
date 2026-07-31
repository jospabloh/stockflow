import React, { useState } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { formatMXN } from "@/lib/vatCalculator";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// Shared color language so the per-row detail always reads as "part of" the
// summary bar above it, not a separate, unrelated widget.
export const FISCAL_COLORS = {
  base16: "text-amber-700 dark:text-amber-400",
  iva16: "text-amber-700 dark:text-amber-400",
  base0: "text-slate-500 dark:text-slate-400",
  subtotal: "text-foreground",
  total: "text-brand-600",
  cash: "text-emerald-700 dark:text-emerald-400",
  other: "text-blue-700 dark:text-blue-400",
};

// Explicación de cada campo — mismo texto en la barra resumen y en el
// detalle por fila, para que "Base 16%" signifique lo mismo en ambos lados.
export const FISCAL_HINTS = {
  base16: "Base gravable (sin IVA) de las líneas con IVA 16%. Se calcula dividiendo el total de cada línea entre 1.16.",
  iva16: "IVA (16%) de esas mismas líneas: el total de línea menos su base gravable.",
  base0: "Importe de las líneas exentas de IVA (tasa 0%). Aquí el total de línea completo es la base, sin restar nada.",
  subtotal: "Base 16% + Base 0%: el valor de la venta antes de sumar el IVA.",
  total: "Subtotal + IVA 16%: el monto total de la venta.",
  cash: "Suma de los pagos registrados en efectivo. Usa el detalle de pagos parciales si existe; si la cotización se pagó de una sola vez, cuenta el total completo cuando el método fue efectivo.",
  other: "Igual que Efectivo, pero para cualquier pago con un método distinto (tarjeta, transferencia, etc.).",
};

// Explica un campo al pasar el mouse (desktop) o al tocarlo (móvil, sin hover).
// Controlado a mano en vez de dejar el Popover en modo no-controlado: así el
// mismo trigger sirve para hover-to-show en desktop y tap-to-toggle en móvil
// sin que un evento pise al otro.
function InfoPopover({ hint, children }) {
  const [open, setOpen] = useState(false);
  if (!hint) return children;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 text-xs leading-relaxed text-muted-foreground"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {hint}
      </PopoverContent>
    </Popover>
  );
}

export function StatPill({ label, value, valueClassName = "", size = "md", hint }) {
  const labelCls = size === "sm" ? "text-[9px]" : "text-[10px]";
  const valueCls = size === "sm" ? "text-xs" : "text-sm";
  return (
    <InfoPopover hint={hint}>
      <div className="flex flex-col justify-center shrink-0">
        <span className={`${labelCls} font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap`}>
          {label}
        </span>
        <span className={`font-mono tabular-nums ${valueCls} font-semibold whitespace-nowrap ${valueClassName}`}>
          ${formatMXN(value)}
        </span>
      </div>
    </InfoPopover>
  );
}

export function StatDivider({ size = "md" }) {
  return <div className={`w-px self-stretch ${size === "sm" ? "my-1" : "my-2"} bg-border shrink-0`} aria-hidden="true" />;
}

export function PaymentProportionBar({ cashPaid, otherPaid, size = "md" }) {
  const paidTotal = cashPaid + otherPaid;
  if (paidTotal <= 0) return null;
  const cashPct = Math.round((cashPaid / paidTotal) * 100);
  return (
    <div className={`hidden sm:flex flex-col justify-center gap-1 shrink-0 ${size === "sm" ? "w-16" : "w-20"}`}>
      <div
        className={`${size === "sm" ? "h-1" : "h-1.5"} rounded-full bg-blue-200 dark:bg-blue-900/40 overflow-hidden`}
        role="img"
        aria-label={`${cashPct}% cobrado en efectivo, ${100 - cashPct}% en otro método`}
      >
        <div className="h-full bg-emerald-500" style={{ width: `${cashPct}%` }} />
      </div>
      {size !== "sm" && <span className="text-[9px] text-muted-foreground text-center whitespace-nowrap">{cashPct}% efectivo</span>}
    </div>
  );
}

export function PaymentPills({ cashPaid, otherPaid, size = "md", cashHint, otherHint }) {
  const paidTotal = cashPaid + otherPaid;
  const labelCls = size === "sm" ? "text-[9px]" : "text-[10px]";
  const valueCls = size === "sm" ? "text-xs" : "text-sm";
  const iconCls = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  if (paidTotal <= 0) {
    return <span className={`${labelCls} text-muted-foreground italic whitespace-nowrap`}>Sin pagos registrados</span>;
  }

  return (
    <>
      <InfoPopover hint={cashHint}>
        <div className="flex flex-col justify-center shrink-0">
          <span className={`flex items-center gap-1 ${labelCls} font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap`}>
            <Banknote className={`${iconCls} ${FISCAL_COLORS.cash}`} /> Efectivo
          </span>
          <span className={`font-mono tabular-nums ${valueCls} font-semibold ${FISCAL_COLORS.cash} whitespace-nowrap`}>
            ${formatMXN(cashPaid)}
          </span>
        </div>
      </InfoPopover>
      <InfoPopover hint={otherHint}>
        <div className="flex flex-col justify-center shrink-0">
          <span className={`flex items-center gap-1 ${labelCls} font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap`}>
            <CreditCard className={`${iconCls} ${FISCAL_COLORS.other}`} /> Otro método
          </span>
          <span className={`font-mono tabular-nums ${valueCls} font-semibold ${FISCAL_COLORS.other} whitespace-nowrap`}>
            ${formatMXN(otherPaid)}
          </span>
        </div>
      </InfoPopover>
      <PaymentProportionBar cashPaid={cashPaid} otherPaid={otherPaid} size={size} />
    </>
  );
}
