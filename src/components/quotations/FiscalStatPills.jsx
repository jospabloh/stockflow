import React from "react";
import { Banknote, CreditCard } from "lucide-react";
import { formatMXN } from "@/lib/vatCalculator";

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

export function StatPill({ label, value, valueClassName = "", size = "md" }) {
  const labelCls = size === "sm" ? "text-[9px]" : "text-[10px]";
  const valueCls = size === "sm" ? "text-xs" : "text-sm";
  return (
    <div className="flex flex-col justify-center shrink-0">
      <span className={`${labelCls} font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap`}>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${valueCls} font-semibold whitespace-nowrap ${valueClassName}`}>
        ${formatMXN(value)}
      </span>
    </div>
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
    <div className={`hidden sm:flex flex-col justify-center gap-1 shrink-0 ${size === "sm" ? "w-16" : "w-24"}`}>
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

export function PaymentPills({ cashPaid, otherPaid, size = "md" }) {
  const paidTotal = cashPaid + otherPaid;
  const labelCls = size === "sm" ? "text-[9px]" : "text-[10px]";
  const valueCls = size === "sm" ? "text-xs" : "text-sm";
  const iconCls = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  if (paidTotal <= 0) {
    return <span className={`${labelCls} text-muted-foreground italic whitespace-nowrap`}>Sin pagos registrados</span>;
  }

  return (
    <>
      <div className="flex flex-col justify-center shrink-0">
        <span className={`flex items-center gap-1 ${labelCls} font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap`}>
          <Banknote className={`${iconCls} ${FISCAL_COLORS.cash}`} /> Efectivo
        </span>
        <span className={`font-mono tabular-nums ${valueCls} font-semibold ${FISCAL_COLORS.cash} whitespace-nowrap`}>
          ${formatMXN(cashPaid)}
        </span>
      </div>
      <div className="flex flex-col justify-center shrink-0">
        <span className={`flex items-center gap-1 ${labelCls} font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap`}>
          <CreditCard className={`${iconCls} ${FISCAL_COLORS.other}`} /> Otro método
        </span>
        <span className={`font-mono tabular-nums ${valueCls} font-semibold ${FISCAL_COLORS.other} whitespace-nowrap`}>
          ${formatMXN(otherPaid)}
        </span>
      </div>
      <PaymentProportionBar cashPaid={cashPaid} otherPaid={otherPaid} size={size} />
    </>
  );
}
