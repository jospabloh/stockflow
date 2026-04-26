import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

function fmt(n) {
  return (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getBalance(q) {
  if (q.balance != null) return q.balance;
  if (q.paid) return 0;
  const amountPaid = q.amount_paid != null ? q.amount_paid : 0;
  return (q.total || 0) - amountPaid;
}

export default function PendingBalanceAlert({ businessId }) {
  const [pendingQuotations, setPendingQuotations] = useState([]);

  useEffect(() => {
    if (!businessId) return;
    base44.entities.Quotation.filter(
      { business_id: businessId, delivered: true, paid: false },
      "-created_date",
      50
    ).then(qs => {
      const withBalance = qs.filter(q => getBalance(q) > 0.01);
      setPendingQuotations(withBalance);
    }).catch(() => {});
  }, [businessId]);

  if (pendingQuotations.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-red-400 bg-red-50 dark:bg-red-950/30">
      <div className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-red-800 dark:text-red-300">
            Saldo Pendiente — Entregadas sin cobrar
          </h3>
          <span className="ml-auto text-xs text-red-500 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-full">
            {pendingQuotations.length}
          </span>
        </div>
        <div className="space-y-2">
          {pendingQuotations.slice(0, 5).map((q) => {
            const balance = getBalance(q);
            return (
              <div key={q.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300 truncate">
                    #{q.folio} — {q.client_name}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">Entregada con saldo pendiente</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="font-bold text-red-700 dark:text-red-400 text-sm">${fmt(balance)}</span>
                  <Link
                    to={createPageUrl("Quotations")}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium whitespace-nowrap"
                  >
                    Ver →
                  </Link>
                </div>
              </div>
            );
          })}
          {pendingQuotations.length > 5 && (
            <Link
              to={createPageUrl("Quotations")}
              className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Ver todas ({pendingQuotations.length}) →
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}