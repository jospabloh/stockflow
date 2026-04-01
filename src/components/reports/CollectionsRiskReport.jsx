import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle, AlertCircle } from "lucide-react";
import moment from "moment";

export default function CollectionsRiskReport({ quotations, dateFrom, dateTo }) {
  const collectionsData = useMemo(() => {
    const today = moment();

    return quotations
      .filter((q) => q.status === "converted" && !q.paid)
      .map((q) => {
        const createdDate = moment(q.created_date);
        const ageInDays = today.diff(createdDate, "days");
        const pendingAmount = (q.total || 0) - ((q.paid ? q.total : 0) || 0);
        
        let riskScore = 0;
        let riskLabel = "bajo";

        // Scoring lógico determinístico (sin IA externa)
        if (ageInDays > 60) {
          riskScore += 40;
          riskLabel = "crítico";
        } else if (ageInDays > 30) {
          riskScore += 25;
          riskLabel = ageInDays > 45 ? "alto" : "medio";
        } else if (ageInDays > 14) {
          riskScore += 10;
          riskLabel = "medio";
        }

        if (pendingAmount > 5000) {
          riskScore += 15;
        }

        if (q.delivered && !q.paid) {
          riskScore += 5;
        }

        riskLabel = riskScore >= 50 ? "crítico" : riskScore >= 30 ? "alto" : riskScore >= 10 ? "medio" : "bajo";

        return {
          id: q.id,
          client: q.client_name,
          pendingAmount: Math.round(pendingAmount),
          ageInDays,
          delivered: q.delivered,
          riskScore,
          riskLabel,
          followUpPriority: riskLabel === "crítico" ? "URGENTE" : riskLabel === "alto" ? "Alta" : riskLabel === "medio" ? "Normal" : "Baja"
        };
      })
      .filter((q) => q.riskLabel !== "bajo")
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [quotations]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-orange-50/50">
        <h3 className="font-semibold text-slate-700">Riesgo de Cobranza</h3>
        <p className="text-xs text-slate-400 mt-0.5">Clientes y transacciones con riesgo de pago tardío o no pago</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Monto Pendiente</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Edad (días)</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Entregado</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Riesgo</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Prioridad Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            {collectionsData.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">Sin riesgos de cobranza detectados ✓</td></tr>
            ) : (
              collectionsData.map((q) => (
                <tr key={q.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{q.client}</td>
                  <td className="px-4 py-3 text-right text-slate-700">${q.pendingAmount.toLocaleString("es-MX")}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{q.ageInDays}</td>
                  <td className="px-4 py-3 text-center">
                    {q.delivered ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" /> : <AlertCircle className="h-4 w-4 text-slate-400 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      q.riskLabel === "crítico" ? "bg-red-100 text-red-700" :
                      q.riskLabel === "alto" ? "bg-orange-100 text-orange-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {q.riskLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-semibold">{q.followUpPriority}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-50/50 border-t text-xs text-slate-600">
        <p>💡 Puntuación: +40 (&gt;60 días), +25 (&gt;30 días), +10 (&gt;14 días), +15 (monto&gt;$5000), +5 (entregado sin pago).</p>
      </div>
    </Card>
  );
}