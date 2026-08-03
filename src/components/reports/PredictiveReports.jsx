import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MobileSelect } from "@/components/ui/MobileSelect";
import ExportMenu from "@/components/common/ExportMenu";
import { usePermissions } from "@/lib/PermissionContext";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import moment from "moment";
import DepletionRiskReport from "@/components/reports/DepletionRiskReport";
import ReorderSuggestionReport from "@/components/reports/ReorderSuggestionReport";
import CollectionsRiskReport from "@/components/reports/CollectionsRiskReport";
import AnomaliesReport from "@/components/reports/AnomaliesReport";
import TopSalesByClientReport from "@/components/reports/TopSalesByClientReport";

export default function PredictiveReports({
  products,
  movements,
  quotations,
  categories,
  dateFrom,
  dateTo,
}) {
  const { can } = usePermissions();
  const canExport = can('Reportes', 'export');
  const [topSelling] = useState(() => {
    const filteredMovements = movements.filter((m) => {
      const date = moment(m.created_date);
      return m.type === "exit" && date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    });
    const sales = {};
    filteredMovements.forEach((m) => {
      if (!sales[m.product_id]) {
        sales[m.product_id] = { name: m.product_name, qty: 0, value: 0 };
      }
      sales[m.product_id].qty += m.quantity;
      sales[m.product_id].value += (m.total || 0);
    });
    return Object.values(sales)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((p) => ({ 
        name: p.name?.length > 20 ? p.name.slice(0, 20) + "…" : p.name, 
        cantidad: p.qty,
        valor: Math.round(p.value)
      }));
  });

  const [lowRotation] = useState(() => {
    const filteredMovements = movements.filter((m) => {
      const date = moment(m.created_date);
      return date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    });
    const exits = {};
    const lastMovementDate = {};
    filteredMovements.filter((m) => m.type === "exit").forEach((m) => {
      exits[m.product_id] = (exits[m.product_id] || 0) + m.quantity;
      const d = moment(m.created_date);
      if (!lastMovementDate[m.product_id] || d.isAfter(lastMovementDate[m.product_id])) {
        lastMovementDate[m.product_id] = d;
      }
    });
    return products
      .filter((p) => p.status === "active" && exits[p.id] !== undefined)
      .map((p) => ({
        name: p.name?.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
        salidas: exits[p.id] || 0,
        stock: p.stock,
        ultima_salida: lastMovementDate[p.id] ? lastMovementDate[p.id].format("DD/MM/YY") : "—",
      }))
      .sort((a, b) => a.salidas - b.salidas)
      .slice(0, 10);
  });

  const [dailyTrend] = useState(() => {
    const filteredMovements = movements.filter((m) => {
      const date = moment(m.created_date);
      return date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    });
    const days = {};
    for (let d = moment(dateFrom); d.isSameOrBefore(dateTo); d.add(1, "day")) {
      days[d.format("DD/MM")] = { entries: 0, exits: 0 };
    }
    filteredMovements.forEach((m) => {
      const key = moment(m.created_date).format("DD/MM");
      if (days[key]) {
        if (m.type === "entry") days[key].entries += m.quantity;
        if (m.type === "exit") days[key].exits += m.quantity;
      }
    });
    return Object.entries(days).map(([day, data]) => ({
      dia: day,
      Entradas: data.entries,
      Salidas: data.exits,
    }));
  });

  const topSellingColumns = [
    { key: "name", label: "Producto", type: "text" },
    { key: "cantidad", label: "Cantidad", type: "number" },
    { key: "valor", label: "Valor", type: "currency" },
  ];

  const lowRotationColumns = [
    { key: "name", label: "Producto", type: "text" },
    { key: "salidas", label: "Salidas", type: "number" },
    { key: "stock", label: "Stock Actual", type: "number" },
    { key: "min", label: "M\u00EDnimo", type: "number" },
    { key: "ultima_salida", label: "\u00DAltima Salida", type: "text" },
  ];

  const lowRotationRows = lowRotation.map((p) => ({
    name: p.name,
    salidas: p.salidas,
    stock: p.stock,
    min: products.find((pr) => pr.name === p.name)?.min_stock || 5,
    ultima_salida: p.ultima_salida,
  }));

  const trendColumns = [
    { key: "dia", label: "D\u00EDa", type: "text" },
    { key: "entradas", label: "Entradas", type: "number" },
    { key: "salidas", label: "Salidas", type: "number" },
  ];

  const trendRows = dailyTrend.map((d) => ({
    dia: d.dia,
    entradas: d.Entradas,
    salidas: d.Salidas,
  }));

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pivot" className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="pivot">Análisis Dinámico</TabsTrigger>
          <TabsTrigger value="topClients">Top Clientes</TabsTrigger>
          <TabsTrigger value="sales">Más Vendidos</TabsTrigger>
          <TabsTrigger value="low">Baja Rotación</TabsTrigger>
          <TabsTrigger value="trend">Tendencia</TabsTrigger>
          <TabsTrigger value="depletion">Riesgo Agotamiento</TabsTrigger>
          <TabsTrigger value="reorder">Sugerencia Resurtido</TabsTrigger>
          <TabsTrigger value="collections">Riesgo Cobranza</TabsTrigger>
          <TabsTrigger value="anomalies">Discrepancias</TabsTrigger>
        </TabsList>

        {/* Análisis Dinámico / Pivot */}
        <TabsContent value="pivot">
          <DynamicPivotReport
            movements={movements}
            quotations={quotations}
            products={products}
            categories={categories}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>

        {/* Top de Ventas por Cliente */}
        <TabsContent value="topClients">
          <TopSalesByClientReport
            quotations={quotations}
            movements={movements}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>

        {/* Más Vendidos */}
        <TabsContent value="sales">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-700">Productos Más Vendidos (por valor)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Período seleccionado</p>
              </div>
              {canExport && (
              <ExportMenu
                columns={topSellingColumns}
                rows={topSelling}
                filename="productos_mas_vendidos"
                title="Productos Más Vendidos"
              />
              )}
            </div>
            {topSelling.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p>Sin ventas registradas en el período seleccionado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topSelling.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{idx + 1}. {p.name}</span>
                      <span className="text-slate-600 tabular">${p.valor.toLocaleString("es-MX")} · {p.cantidad} u.</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-brand-500 to-accent-500 h-full rounded-full"
                        style={{ width: `${(p.valor / topSelling[0].valor) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Baja Rotación */}
        <TabsContent value="low">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-amber-50/50">
              <div>
                <h3 className="font-semibold text-slate-700">Productos de Baja Rotación</h3>
                <p className="text-xs text-slate-400 mt-0.5">Productos con menor movimiento en el período seleccionado</p>
              </div>
              {canExport && (
              <ExportMenu
                columns={lowRotationColumns}
                rows={lowRotationRows}
                filename="baja_rotacion"
                title="Productos de Baja Rotación"
              />
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Salidas</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Stock Act.</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Mín.</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Última Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {lowRotation.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-slate-400">Sin productos con salidas en el período</td></tr>
                  ) : (
                    lowRotation.map((p) => {
                      const prod = products.find(pr => pr.name === p.name);
                      return (
                        <tr key={p.name} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-600 tabular">{p.salidas}</td>
                          <td className="px-4 py-3 text-center text-slate-700 tabular">{p.stock}</td>
                          <td className="px-4 py-3 text-center text-slate-500 tabular">{prod?.min_stock || 5}</td>
                          <td className="px-4 py-3 text-slate-600">{p.ultima_salida}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50/50 border-t text-xs text-slate-500">
              <p>💡 Estos productos tienen pocas salidas en el período. Considere: reducir stock, revisar precios, o impulsar ventas.</p>
            </div>
          </Card>
        </TabsContent>

        {/* Tendencia */}
        <TabsContent value="trend">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Tendencia de Movimientos</h3>
              {canExport && (
              <ExportMenu
                columns={trendColumns}
                rows={trendRows}
                filename="tendencia_movimientos"
                title="Tendencia de Movimientos"
              />
              )}
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                <Line type="monotone" dataKey="Entradas" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Salidas" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* Riesgo de Agotamiento */}
        <TabsContent value="depletion">
          <DepletionRiskReport
            products={products}
            movements={movements}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>

        {/* Sugerencia de Resurtido */}
        <TabsContent value="reorder">
          <ReorderSuggestionReport
            products={products}
            movements={movements}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>

        {/* Riesgo de Cobranza */}
        <TabsContent value="collections">
          <CollectionsRiskReport
            quotations={quotations}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>

        {/* Discrepancias / Anomalías */}
        <TabsContent value="anomalies">
          <AnomaliesReport
            products={products}
            movements={movements}
            quotations={quotations}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente Pivot Dinámico
function DynamicPivotReport({ movements, products, categories, dateFrom, dateTo }) {
  const { can } = usePermissions();
  const canExport = can('Reportes', 'export');
  const [rowGroupBy, setRowGroupBy] = useState("product");
  const [colGroupBy, setColGroupBy] = useState("month");
  const [metricType, setMetricType] = useState("sum");
  const [metric, setMetric] = useState("value");

  const filteredMovements = movements.filter((m) => {
    const date = moment(m.created_date);
    return m.type === "exit" && date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
  });

  const pivotData = useMemo(() => {
    const data = {};
    const columnKeys = new Set();

    filteredMovements.forEach((m) => {
      const rowKey = rowGroupBy === "product" 
        ? m.product_name 
        : rowGroupBy === "category"
        ? categories.find(c => c.id === products.find(p => p.id === m.product_id)?.category)?.name || "Sin categoría"
        : rowGroupBy === "client"
        ? m.reason || "Directo"
        : "Total";

      const date = moment(m.created_date);
      const colKey = colGroupBy === "month"
        ? date.format("MMM YYYY")
        : colGroupBy === "week"
        ? `Sem ${date.format("ww/YY")}`
        : date.format("DD/MM/YY");

      columnKeys.add(colKey);

      if (!data[rowKey]) {
        data[rowKey] = {};
      }

      if (!data[rowKey][colKey]) {
        data[rowKey][colKey] = { count: 0, sum: 0, avg: 0, min: Infinity, max: -Infinity, values: [] };
      }

      const value = metric === "value" ? (m.total || 0) : m.quantity;
      data[rowKey][colKey].values.push(value);
      data[rowKey][colKey].count += 1;
      data[rowKey][colKey].sum += value;
      data[rowKey][colKey].min = Math.min(data[rowKey][colKey].min, value);
      data[rowKey][colKey].max = Math.max(data[rowKey][colKey].max, value);
    });

    Object.keys(data).forEach(row => {
      Object.keys(data[row]).forEach(col => {
        data[row][col].avg = data[row][col].count > 0 ? data[row][col].sum / data[row][col].count : 0;
      });
    });

    return { data, columnKeys: Array.from(columnKeys).sort() };
  }, [filteredMovements, rowGroupBy, colGroupBy, metric, products, categories]);

  const getDisplayValue = (colData) => {
    if (metricType === "sum") return colData.sum.toFixed(0);
    if (metricType === "count") return colData.count;
    if (metricType === "avg") return colData.avg.toFixed(2);
    if (metricType === "min") return colData.min === Infinity ? "—" : colData.min.toFixed(0);
    if (metricType === "max") return colData.max === -Infinity ? "—" : colData.max.toFixed(0);
    return "—";
  };

  const getTotalValue = (colData) => {
    if (metricType === "sum") return colData.sum;
    if (metricType === "count") return colData.count;
    if (metricType === "avg") return colData.avg;
    if (metricType === "min") return colData.min === Infinity ? 0 : colData.min;
    if (metricType === "max") return colData.max === -Infinity ? 0 : colData.max;
    return 0;
  };

  const rows = Object.keys(pivotData.data).sort();
  const cols = pivotData.columnKeys;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-purple-50/50">
        <h3 className="font-semibold text-slate-700 mb-3">Análisis Dinámico / Pivot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="min-w-[140px]">
            <label className="text-xs text-slate-500 mb-1 block">Agrupar Filas</label>
            <MobileSelect 
              value={rowGroupBy} 
              onValueChange={setRowGroupBy} 
              options={[
                { value: "product", label: "Por Producto" },
                { value: "category", label: "Por Categoría" },
                { value: "client", label: "Por Cliente" }
              ]} 
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-slate-500 mb-1 block">Agrupar Columnas</label>
            <MobileSelect 
              value={colGroupBy} 
              onValueChange={setColGroupBy} 
              options={[
                { value: "month", label: "Por Mes" },
                { value: "week", label: "Por Semana" },
                { value: "day", label: "Por Día" }
              ]} 
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-slate-500 mb-1 block">Métrica</label>
            <MobileSelect 
              value={metric} 
              onValueChange={setMetric} 
              options={[
                { value: "value", label: "Valor ($)" },
                { value: "quantity", label: "Cantidad" }
              ]} 
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-slate-500 mb-1 block">Agregación</label>
            <MobileSelect 
              value={metricType} 
              onValueChange={setMetricType} 
              options={[
                { value: "sum", label: "Suma" },
                { value: "count", label: "Contar" },
                { value: "avg", label: "Promedio" },
                { value: "min", label: "Mínimo" },
                { value: "max", label: "Máximo" }
              ]} 
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        {rows.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p>Sin datos para la combinación seleccionada</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                  {rowGroupBy === "product" ? "Producto" : rowGroupBy === "category" ? "Categoría" : "Cliente"}
                </th>
                {cols.map(col => (
                  <th key={col} className="border border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold text-slate-700 whitespace-nowrap">
                    {col}
                  </th>
                ))}
                <th className="border border-slate-200 bg-brand-50 px-3 py-2 text-right font-semibold text-brand-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowTotal = cols.reduce((sum, col) => sum + getTotalValue(pivotData.data[row][col] || { sum: 0, count: 0, avg: 0, min: Infinity, max: -Infinity }), 0);
                return (
                  <tr key={row}>
                    <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700 bg-slate-50/50">{row}</td>
                    {cols.map(col => (
                      <td key={`${row}-${col}`} className="border border-slate-200 px-2 py-2 text-center text-slate-600 tabular">
                        {pivotData.data[row][col] ? getDisplayValue(pivotData.data[row][col]) : "—"}
                      </td>
                    ))}
                    <td className="border border-slate-200 px-3 py-2 text-right font-semibold text-brand-700 bg-brand-50/50 tabular">
                      {rowTotal.toFixed(metricType === "avg" ? 2 : 0)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-emerald-50/50 font-bold">
                <td className="border border-slate-200 px-3 py-2 text-slate-800">TOTAL</td>
                {cols.map(col => {
                  const colTotal = rows.reduce((sum, row) => sum + getTotalValue(pivotData.data[row][col] || { sum: 0, count: 0, avg: 0, min: Infinity, max: -Infinity }), 0);
                  return (
                    <td key={`total-${col}`} className="border border-slate-200 px-2 py-2 text-center text-emerald-700 tabular">
                      {colTotal.toFixed(metricType === "avg" ? 2 : 0)}
                    </td>
                  );
                })}
                <td className="border border-slate-200 px-3 py-2 text-right text-emerald-700 tabular">
                  {rows.reduce((sum, row) => sum + cols.reduce((cs, col) => cs + getTotalValue(pivotData.data[row][col] || { sum: 0, count: 0, avg: 0, min: Infinity, max: -Infinity }), 0), 0).toFixed(metricType === "avg" ? 2 : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="p-4 border-t bg-slate-50 flex items-center gap-2">
        <p className="text-xs text-slate-600 flex-1">💡 Selecciona filas, columnas, métrica y agregación para análisis personalizados.</p>
        {canExport && (
        <ExportMenu
          filename="analisis_dinamico"
          title="Análisis Dinámico"
          getData={() => {
            const rowLabel = rowGroupBy === "product" ? "Producto" : rowGroupBy === "category" ? "Categoría" : "Cliente";
            const columns = [
              { key: "__row", label: rowLabel, type: "text" },
              ...cols.map((col) => ({ key: col, label: col, type: "number" })),
            ];
            const exportRows = rows.map((row) => {
              const obj = { __row: row };
              cols.forEach((col) => {
                obj[col] = pivotData.data[row][col] ? getDisplayValue(pivotData.data[row][col]) : "—";
              });
              return obj;
            });
            return { columns, rows: exportRows };
          }}
        />
        )}
      </div>
    </Card>
  );
}