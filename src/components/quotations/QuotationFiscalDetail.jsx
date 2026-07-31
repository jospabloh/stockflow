import React, { useMemo } from "react";
import { CornerDownRight } from "lucide-react";
import { computeQuotationFiscalBreakdown } from "@/lib/quotationsFinancialSummary";
import { StatPill, StatDivider, PaymentPills, FISCAL_COLORS, FISCAL_HINTS } from "@/components/quotations/FiscalStatPills";

export default function QuotationFiscalDetail({ q, className = "" }) {
  const b = useMemo(() => computeQuotationFiscalBreakdown(q), [q]);

  return (
    <div className={`flex items-center gap-1 flex-wrap sm:flex-nowrap overflow-x-auto bg-muted/30 border-t border-border px-4 py-2 ${className}`}>
      <CornerDownRight className="h-3 w-3 text-muted-foreground/60 shrink-0 mr-1" />

      <div className="flex items-center gap-3 shrink-0">
        <StatPill label="Base 16%" value={b.base16} valueClassName={FISCAL_COLORS.base16} size="sm" hint={FISCAL_HINTS.base16} />
        <StatPill label="IVA 16%" value={b.iva16} valueClassName={FISCAL_COLORS.iva16} size="sm" hint={FISCAL_HINTS.iva16} />
        <StatPill label="Base 0%" value={b.base0} valueClassName={FISCAL_COLORS.base0} size="sm" hint={FISCAL_HINTS.base0} />
      </div>

      <StatDivider size="sm" />

      <div className="flex items-center gap-3 shrink-0">
        <StatPill label="Subtotal" value={b.subtotal} valueClassName={FISCAL_COLORS.subtotal} size="sm" hint={FISCAL_HINTS.subtotal} />
        <StatPill label="Total" value={b.total} valueClassName={`${FISCAL_COLORS.total} text-sm`} size="sm" hint={FISCAL_HINTS.total} />
      </div>

      <StatDivider size="sm" />

      <div className="flex items-center gap-3 shrink-0">
        <PaymentPills cashPaid={b.cashPaid} otherPaid={b.otherPaid} size="sm" cashHint={FISCAL_HINTS.cash} otherHint={FISCAL_HINTS.other} />
      </div>
    </div>
  );
}
