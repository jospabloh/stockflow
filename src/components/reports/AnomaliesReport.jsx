import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import moment from "moment";

export default function AnomaliesReport({ products, movements, quotations, dateFrom, dateTo }) {
  const anomalies = useMemo(() => {
    const found = [];
    
    // ANOMALÍA 1: Salidas sin explicación clara (no vinculadas a cotización)
    const exitMovements = movements.filter((m) => {
      const date = moment(m.created_date);
      return m.type === "exit" && date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    });

    exitMovements.forEach((m) => {
      if (!m.quotation_id && !m.reason) {
        found.push({
          type: "salida_sin_referencia",
          severity: "medium",
          record: `Movimiento ${m.id}`,
          entity: m.product_name,
          date: moment(m.created_date).format("DD/MM/YY"),
          explanation: "Salida sin cotización ni cliente identificado",
          action: "Verificar trazabilidad del movimiento"
        });
      }
    });

    // ANOMALÍA 2: Stock inconsistente (actual < mínimo sin movimiento reciente)
    const today = moment();
    products.filter((p) => p.status === "active").forEach((p) => {
      if ((p.stock || 0) < (p.min_stock || 5)) {
        const lastExit = exitMovements
          .filter((m) => m.product_id === p.id)
          .sort((a, b) => moment(b.created_date) - moment(a.created_date))[0];
        
        const daysSinceLastExit = lastExit ? today.diff(moment(lastExit.created_date), "days") : 999;

        if (daysSinceLastExit > 10) {
          found.push({
            type: "stock_bajo_sin_movimiento",
            severity: "high",
            record: p.name,
            entity: p.name,
            date: moment(p.updated_date).format("DD/MM/YY"),
            explanation: `Stock ${p.stock || 0} está bajo mínimo (${p.min_stock || 5}) sin movimiento reciente`,
            action: "Revisar integridad de datos y realizar ajuste si es necesario"
          });
        }
      }
    });

    // ANOMALÍA 3: Cotizaciones sin pago después de ser entregadas (muy antiguas)
    quotations.forEach((q) => {
      if (q.delivered && !q.paid && q.status === "converted") {
        const ageInDays = today.diff(moment(q.created_date), "days");
        if (ageInDays > 90) {
          found.push({
            type: "entrega_sin_pago_muy_antigua",
            severity: "high",
            record: `Cot ${q.folio}`,
            entity: q.client_name,
            date: moment(q.created_date).format("DD/MM/YY"),
            explanation: `Cotización entregada hace ${ageInDays} días sin pago registrado`,
            action: "Contactar cliente inmediatamente o revisar proceso de cobranza"
          });
        }
      }
    });

    // ANOMALÍA 4: Entradas y salidas inusuales en un solo día (posible error manual)
    const dailyExits = {};
    exitMovements.forEach((m) => {
      const key = moment(m.created_date).format("YYYY-MM-DD");
      if (!dailyExits[key]) {
        dailyExits[key] = 0;
      }
      dailyExits[key] += m.quantity || 0;
    });

    Object.entries(dailyExits).forEach(([date, qty]) => {
      if (qty > 1000) {
        found.push({
          type: "pico_salidas_anormal",
          severity: "medium",
          record: date,
          entity: "Sistema",
          date: moment(date).format("DD/MM/YY"),
          explanation: `${qty} unidades salieron en un solo día (posible error o venta masiva)`,
          action: "Verificar si fue venta legítima o entrada incorrecta como salida"
        });
      }
    });

    // ANOMALÍA 5: Productos sin movimiento pero con stock
    const productsWithNoExits = products.filter((p) => 
      p.status === "active" && 
      (p.stock || 0) > (p.min_stock || 5) &&
      !exitMovements.some((m) => m.product_id === p.id)
    );

    productsWithNoExits.slice(0, 5).forEach((p) => {
      found.push({
        type: "producto_sin_movimiento",
        severity: "low",
        record: p.name,
        entity: p.name,
        date: moment(p.created_date).format("DD/MM/YY"),
        explanation: "Producto sin movimiento de salida en el período seleccionado",
        action: "Revisar si es producto obsoleto o requiere impulso comercial"
      });
    });

    return found.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [products, movements, quotations, dateFrom, dateTo]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-purple-50/50">
        <h3 className="font-semibold text-slate-700">Discrepancias / Anomalías</h3>
        <p className="text-xs text-slate-400 mt-0.5">Registros inusuales o potencialmente problemáticos detectados por reglas internas determinísticas</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Tipo de Anomalía</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Registro</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Entidad</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Explicación</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Severidad</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Acción Recomendada</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">Sin anomalías detectadas ✓</td></tr>
            ) : (
              anomalies.map((a, idx) => (
                <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-slate-700">{a.record}</td>
                  <td className="px-4 py-3 text-slate-700">{a.entity}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">{a.explanation}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      a.severity === "critical" ? "bg-red-100 text-red-700" :
                      a.severity === "high" ? "bg-orange-100 text-orange-700" :
                      a.severity === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-50/50 border-t text-xs text-slate-600">
        <p>💡 Reglas: 1) Salida sin referencia, 2) Stock bajo sin movimiento reciente, 3) Entrega sin pago &gt;90 días, 4) Picos inusuales (&gt;1000 u/día), 5) Productos estancados.</p>
      </div>
    </Card>
  );
}