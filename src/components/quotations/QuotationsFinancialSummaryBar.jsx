import React, { useMemo } from "react";
import { Receipt } from "lucide-react";
import { summarizeQuotationsFinancials } from "@/lib/quotationsFinancialSummary";
import { StatPill, StatDivider, PaymentPills, FISCAL_COLORS } from "@/components/quotations/FiscalStatPills";

export default function QuotationsFinancialSummaryBar({ quotations, totalVisible }) {
  const s = useMemo(() => summarizeQuotationsFinancials(quotations), [quotations]);

  if (s.count === 0) return null;

  const hasContext = typeof totalVisible === "number" && totalVisible >= s.count;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-stretch overflow-x-auto">
        <div className="flex items-center gap-1.5 pl-3 pr-2.5 shrink-0 border-r border-border">
          <Receipt className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            {hasContext ? (
              <>{s.count} de {totalVisible} concretada{totalVisible !== 1 ? "s" : ""}</>
            ) : (
              <>{s.count} venta{s.count !== 1 ? "s" : ""} concretada{s.count !== 1 ? "s" : ""}</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 px-3 shrink-0">
          <StatPill label="Base 16%" value={s.base16} valueClassName={FISCAL_COLORS.base16} />
          <StatPill label="IVA 16%" value={s.iva16} valueClassName={FISCAL_COLORS.iva16} />
          <StatPill label="Base 0%" value={s.base0} valueClassName={FISCAL_COLORS.base0} />
        </div>

        <StatDivider />

        <div className="flex items-center gap-3 px-3 shrink-0">
          <StatPill label="Subtotal" value={s.subtotal} valueClassName={FISCAL_COLORS.subtotal} />
          <StatPill label="Total" value={s.total} valueClassName={`${FISCAL_COLORS.total} text-base`} />
        </div>

        <StatDivider />

        <div className="flex items-center gap-3 px-3 shrink-0">
          <PaymentPills cashPaid={s.cashPaid} otherPaid={s.otherPaid} />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/80 px-4 py-1.5 border-t border-border bg-muted/20">
        Refleja los filtros activos de la tabla. Los montos solo cuentan cotizaciones <strong className="font-medium">Concretadas</strong> (ventas reales) — Borrador, Enviada y Aceptada aún no lo son.
        {hasContext && " El total de la izquierda excluye Canceladas: nunca fueron una venta."}
      </p>
    </div>
  );
}
