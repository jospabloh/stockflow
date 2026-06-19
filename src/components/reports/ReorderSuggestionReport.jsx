import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import ExportMenu from "@/components/common/ExportMenu";
import moment from "moment";

const REORDER_COLUMNS = [
  { key: "producto", label: "Producto", type: "text" },
  { key: "stock", label: "Stock Actual", type: "number" },
  { key: "demanda_diaria", label: "Demanda Diaria", type: "number" },
  { key: "cobertura_dias", label: "Cobertura (días)", type: "number" },
  { key: "cant_sugerida", label: "Cant. Sugerida", type: "number" },
  { key: "urgencia", label: "Urgencia", type: "text" },
  { key: "motivo", label: "Motivo", type: "text" },
];

export default function ReorderSuggestionReport({ products, movements, dateFrom, dateTo }) {
  const reorderData = useMemo(() => {
    const lookbackDays = 30;
    const lookbackStart = moment(dateTo).subtract(lookbackDays, "days").format("YYYY-MM-DD");
    
    const exitsByProduct = {};
    movements.filter((m) => {
      const date = moment(m.created_date);
      return m.type === "exit" && 
             date.isSameOrAfter(lookbackStart) && 
             date.isSameOrBefore(moment(dateTo).endOf("day"));
    }).forEach((m) => {
      if (!exitsByProduct[m.product_id]) {
        exitsByProduct[m.product_id] = 0;
      }
      exitsByProduct[m.product_id] += m.quantity || 0;
    });

    const coverageDays = 30;

    return products
      .filter((p) => p.status === "active")
      .map((p) => {
        const totalExits = exitsByProduct[p.id] || 0;
        const avgDailyDemand = totalExits / lookbackDays;
        const targetStock = avgDailyDemand * coverageDays;
        const suggestedReorderQty = Math.max(0, targetStock - (p.stock || 0));
        
        const needsReorder = (p.stock || 0) <= (p.min_stock || 5) || suggestedReorderQty > 0;

        let urgency = "baja";
        if ((p.stock || 0) <= (p.min_stock || 5)) {
          urgency = "crítica";
        } else if ((p.stock || 0) <= ((p.min_stock || 5) * 1.5)) {
          urgency = "alta";
        } else if (suggestedReorderQty > 0) {
          urgency = "media";
        }

        return {
          id: p.id,
          name: p.name,
          stock: p.stock || 0,
          minStock: p.min_stock || 5,
          avgDemand: avgDailyDemand.toFixed(2),
          coverageDays,
          reorderNeeded: needsReorder,
          urgency,
          suggestedQty: Math.ceil(suggestedReorderQty),
          reason: (p.stock || 0) <= (p.min_stock || 5) ? "Stock bajo mínimo" : "Reposición por demanda"
        };
      })
      .filter((p) => p.reorderNeeded)
      .sort((a, b) => {
        const urgencyOrder = { crítica: 0, alta: 1, media: 2, baja: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });
  }, [products, movements, dateFrom, dateTo]);

  const exportRows = reorderData.map((p) => ({
    producto: p.name,
    stock: p.stock,
    demanda_diaria: p.avgDemand,
    cobertura_dias: p.coverageDays,
    cant_sugerida: p.suggestedQty,
    urgencia: p.urgency,
    motivo: p.reason,
  }));

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-blue-50/50">
        <div>
          <h3 className="font-semibold text-slate-700">Sugerencia de Resurtido</h3>
          <p className="text-xs text-slate-400 mt-0.5">Productos recomendados para resurtir con cantidades sugeridas (cobertura 30 días)</p>
        </div>
        <ExportMenu
          columns={REORDER_COLUMNS}
          rows={exportRows}
          filename="sugerencia_resurtido"
          title="Sugerencia de Resurtido"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Stock Act.</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Demanda Diaria</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Cobertura (días)</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Cant. Sugerida</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Urgencia</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {reorderData.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Sin sugerencias de resurtido</td></tr>
            ) : (
              reorderData.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-center text-slate-700 tabular">{p.stock}</td>
                  <td className="px-4 py-3 text-center text-slate-600 tabular">{p.avgDemand} u</td>
                  <td className="px-4 py-3 text-center text-slate-600 tabular">{p.coverageDays}</td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-700 tabular">{p.suggestedQty} u</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      p.urgency === "crítica" ? "bg-red-100 text-red-700" :
                      p.urgency === "alta" ? "bg-orange-100 text-orange-700" :
                      p.urgency === "media" ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {p.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-50/50 border-t text-xs text-slate-600">
        <p>💡 Cantidad sugerida = (demanda diaria × 30 días) − stock actual. Basado en últimos 30 días de movimiento.</p>
      </div>
    </Card>
  );
}