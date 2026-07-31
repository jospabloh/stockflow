import React, { useMemo } from "react";
import { Banknote, CreditCard, Percent } from "lucide-react";
import { summarizeQuotationsFinancials } from "@/lib/quotationsFinancialSummary";
import { formatMXN } from "@/lib/vatCalculator";

function Stat({ label, value, valueClassName = "", sub }) {
  return (
    <div className="flex flex-col justify-center px-4 py-2.5 shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <span className={`font-mono tabular-nums text-sm font-semibold whitespace-nowrap ${valueClassName}`}>
        ${formatMXN(value)}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{sub}</span>}
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch my-2 bg-border shrink-0" aria-hidden="true" />;
}

export default function QuotationsFinancialSummaryBar({ quotations }) {
  const s = useMemo(() => summarizeQuotationsFinancials(quotations), [quotations]);

  if (s.count === 0) return null;

  const paidTotal = s.cashPaid + s.otherPaid;
  const cashPct = paidTotal > 0 ? Math.round((s.cashPaid / paidTotal) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-stretch overflow-x-auto">
        <div className="flex items-center gap-1.5 pl-4 pr-3 shrink-0 border-r border-border">
          <Percent className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            {s.count} venta{s.count !== 1 ? "s" : ""}
          </span>
        </div>

        <Stat label="Base 16%" value={s.base16} valueClassName="text-amber-700 dark:text-amber-400" />
        <Stat label="IVA 16%" value={s.iva16} valueClassName="text-amber-700 dark:text-amber-400" />
        <Stat label="Base 0%" value={s.base0} valueClassName="text-slate-500 dark:text-slate-400" />

        <Divider />

        <Stat label="Subtotal" value={s.subtotal} valueClassName="text-foreground" />
        <Stat label="Total" value={s.total} valueClassName="text-brand-600 text-base" />

        <Divider />

        <div className="flex items-center gap-4 px-4 shrink-0">
          <div className="flex flex-col justify-center">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              <Banknote className="h-3 w-3 text-emerald-600" /> Efectivo
            </span>
            <span className="font-mono tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              ${formatMXN(s.cashPaid)}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              <CreditCard className="h-3 w-3 text-blue-600" /> Otro método
            </span>
            <span className="font-mono tabular-nums text-sm font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
              ${formatMXN(s.otherPaid)}
            </span>
          </div>
          {paidTotal > 0 && (
            <div className="hidden sm:flex flex-col justify-center gap-1 w-24">
              <div className="h-1.5 rounded-full bg-blue-200 dark:bg-blue-900/40 overflow-hidden" role="img" aria-label={`${cashPct}% cobrado en efectivo, ${100 - cashPct}% en otro método`}>
                <div className="h-full bg-emerald-500" style={{ width: `${cashPct}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground text-center whitespace-nowrap">{cashPct}% efectivo</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
