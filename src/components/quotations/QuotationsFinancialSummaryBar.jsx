import React, { useMemo } from "react";
import { Percent } from "lucide-react";
import { summarizeQuotationsFinancials } from "@/lib/quotationsFinancialSummary";
import { StatPill, StatDivider, PaymentPills, FISCAL_COLORS } from "@/components/quotations/FiscalStatPills";

export default function QuotationsFinancialSummaryBar({ quotations, totalVisible }) {
  const s = useMemo(() => summarizeQuotationsFinancials(quotations), [quotations]);

  if (s.count === 0) return null;

  const scopedToFilter = typeof totalVisible === "number" && totalVisible !== s.count;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-stretch overflow-x-auto">
        <div className="flex items-center gap-1.5 pl-4 pr-3 shrink-0 border-r border-border">
          <Percent className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            {s.count} venta{s.count !== 1 ? "s" : ""} concretada{s.count !== 1 ? "s" : ""}
            {scopedToFilter && <span className="text-muted-foreground/70"> · de {totalVisible} en esta vista</span>}
          </span>
        </div>

        <div className="flex items-center gap-4 px-4 shrink-0">
          <StatPill label="Base 16%" value={s.base16} valueClassName={FISCAL_COLORS.base16} />
          <StatPill label="IVA 16%" value={s.iva16} valueClassName={FISCAL_COLORS.iva16} />
          <StatPill label="Base 0%" value={s.base0} valueClassName={FISCAL_COLORS.base0} />
        </div>

        <StatDivider />

        <div className="flex items-center gap-4 px-4 shrink-0">
          <StatPill label="Subtotal" value={s.subtotal} valueClassName={FISCAL_COLORS.subtotal} />
          <StatPill label="Total" value={s.total} valueClassName={`${FISCAL_COLORS.total} text-base`} />
        </div>

        <StatDivider />

        <div className="flex items-center gap-4 px-4 shrink-0">
          <PaymentPills cashPaid={s.cashPaid} otherPaid={s.otherPaid} />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/80 px-4 py-1.5 border-t border-border bg-muted/20">
        Refleja los filtros activos de la tabla — solo cuenta cotizaciones <strong className="font-medium">Concretadas</strong> de lo que ves abajo (Borrador, Enviada, Aceptada y Cancelada no son ventas todavía).
      </p>
    </div>
  );
}
