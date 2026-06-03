import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import ExportMenu from "@/components/common/ExportMenu";
import moment from "moment";

const RISK_LABELS = { critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo" };

const DEPLETION_COLUMNS = [
  { key: "producto", label: "Producto", type: "text" },
  { key: "stock", label: "Stock Actual", type: "number" },
  { key: "min", label: "Mínimo", type: "number" },
  { key: "promedio_diario", label: "Promedio Diario", type: "number" },
  { key: "dias_restantes", label: "Días Restantes", type: "text" },
  { key: "riesgo", label: "Riesgo", type: "text" },
  { key: "accion", label: "Acción", type: "text" },
];

export default function DepletionRiskReport({ products, movements, dateFrom, dateTo }) {
  const depletionData = useMemo(() => {
    const lookbackDays = 30;
    const lookbackStart = moment(dateTo).subtract(lookbackDays, "days").format("YYYY-MM-DD");
    
    const depletionMovements = movements.filter((m) => {
      const date = moment(m.created_date);
      return m.type === "exit" && 
             date.isSameOrAfter(lookbackStart) && 
             date.isSameOrBefore(moment(dateTo).endOf("day"));
    });

    const exitsByProduct = {};
    depletionMovements.forEach((m) => {
      if (!exitsByProduct[m.product_id]) {
        exitsByProduct[m.product_id] = 0;
      }
      exitsByProduct[m.product_id] += m.quantity || 0;
    });

    return products
      .filter((p) => p.status === "active")
      .map((p) => {
        const totalExits = exitsByProduct[p.id] || 0;
        const avgDailyOutflow = totalExits / lookbackDays;
        const daysRemaining = avgDailyOutflow > 0 ? (p.stock || 0) / avgDailyOutflow : null;
        
        let riskLevel = "low";
        if ((p.stock || 0) <= (p.min_stock || 5)) {
          riskLevel = "critical";
        } else if (daysRemaining !== null && daysRemaining < 7) {
          riskLevel = "critical";
        } else if (daysRemaining !== null && daysRemaining < 14) {
          riskLevel = "high";
        } else if (daysRemaining !== null && daysRemaining < 30) {
          riskLevel = "medium";
        }

        return {
          id: p.id,
          name: p.name,
          stock: p.stock || 0,
          minStock: p.min_stock || 5,
          avgDailyOutflow: avgDailyOutflow.toFixed(2),
          daysRemaining: daysRemaining !== null ? Math.max(0, daysRemaining).toFixed(1) : "N/A",
          riskLevel,
          action: riskLevel === "critical" ? "Urgente resurtido" : riskLevel === "high" ? "Revisar pronto" : riskLevel === "medium" ? "Monitorear" : "Sin acción"
        };
      })
      .filter((p) => p.stock > 0 || p.riskLevel !== "low")
      .sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });
  }, [products, movements, dateFrom, dateTo]);

  const exportRows = depletionData.map((p) => ({
    producto: p.name,
    stock: p.stock,
    min: p.minStock,
    promedio_diario: p.avgDailyOutflow,
    dias_restantes: p.daysRemaining === "N/A" ? "N/A" : `${p.daysRemaining} d`,
    riesgo: RISK_LABELS[p.riskLevel] || p.riskLevel,
    accion: p.action,
  }));

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-red-50/50">
        <div>
          <h3 className="font-semibold text-slate-700">Riesgo de Agotamiento</h3>
          <p className="text-xs text-slate-400 mt-0.5">Productos con riesgo de quedarse sin stock (análisis de últimos 30 días)</p>
        </div>
        <ExportMenu
          columns={DEPLETION_COLUMNS}
          rows={exportRows}
          filename="riesgo_agotamiento"
          title="Riesgo de Agotamiento"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Stock Act.</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Mín.</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Promedio Diario</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Días Restantes</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Riesgo</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {depletionData.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Sin productos en riesgo de agotamiento</td></tr>
            ) : (
              depletionData.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{p.stock}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{p.minStock}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{p.avgDailyOutflow} u</td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {p.daysRemaining === "N/A" ? "N/A" : `${p.daysRemaining} d`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      p.riskLevel === "critical" ? "bg-red-100 text-red-700" :
                      p.riskLevel === "high" ? "bg-orange-100 text-orange-700" :
                      p.riskLevel === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {p.riskLevel === "critical" ? "Crítico" : p.riskLevel === "high" ? "Alto" : p.riskLevel === "medium" ? "Medio" : "Bajo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}