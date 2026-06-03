import React, { useMemo, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { HandCoins, TrendingUp, TrendingDown, Minus } from "lucide-react";
import ExportMenu from "@/components/common/ExportMenu";
import moment from "moment";

const SUPPLIER_PAYMENTS_COLUMNS = [
  { key: "fecha", label: "Fecha", type: "text" },
  { key: "diario", label: "Pago del Día", type: "currency" },
  { key: "acumulado", label: "Acumulado", type: "currency" },
];

/**
 * Gráfica de reporte: línea acumulada de pagos a proveedores en el rango
 * seleccionado, con KPI total + comparación vs período anterior de igual longitud.
 */
export default function SupplierPaymentsReportChart({ dateFrom, dateTo }) {
  const { businessId } = useBusinessContext();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    base44.entities.SupplierPayment
      .filter({ business_id: businessId }, "-payment_date", 2000)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [businessId]);

  const { chartData, currentTotal, previousTotal, diffPct, currentCount, uniqueSuppliers } = useMemo(() => {
    const from = moment(dateFrom, "YYYY-MM-DD");
    const to = moment(dateTo, "YYYY-MM-DD");
    const days = Math.max(1, to.diff(from, "days") + 1);

    const prevFrom = from.clone().subtract(days, "days");
    const prevTo = from.clone().subtract(1, "days");

    const inRange = (d, a, b) => d >= a.format("YYYY-MM-DD") && d <= b.format("YYYY-MM-DD");

    const currentPayments = payments.filter(p => p.payment_date && inRange(p.payment_date, from, to));
    const previousPayments = payments.filter(p => p.payment_date && inRange(p.payment_date, prevFrom, prevTo));

    const currentTotal = currentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const previousTotal = previousPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    // Acumulado diario
    const byDate = new Map();
    currentPayments.forEach(p => {
      byDate.set(p.payment_date, (byDate.get(p.payment_date) || 0) + (Number(p.amount) || 0));
    });

    const data = [];
    let acc = 0;
    const cursor = from.clone();
    while (cursor.isSameOrBefore(to)) {
      const key = cursor.format("YYYY-MM-DD");
      const dayAmount = byDate.get(key) || 0;
      acc += dayAmount;
      data.push({
        label: cursor.format("DD/MM"),
        date: key,
        Diario: dayAmount,
        Acumulado: acc,
      });
      cursor.add(1, "day");
    }

    const diffPct = previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0 ? 100 : 0;

    const uniqueSuppliers = new Set(currentPayments.map(p => p.supplier_id).filter(Boolean)).size;

    return {
      chartData: data,
      currentTotal,
      previousTotal,
      diffPct,
      currentCount: currentPayments.length,
      uniqueSuppliers,
    };
  }, [payments, dateFrom, dateTo]);

  if (loading) {
    return (
      <Card className="border-0 shadow-sm p-8">
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  const diffPositive = diffPct > 0.01;
  const diffNegative = diffPct < -0.01;
  const diffColor = diffPositive ? "rose" : diffNegative ? "emerald" : "slate";

  return (
    <div className="space-y-6">
      {/* KPI header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-100 text-xs font-medium uppercase tracking-wider">Total período</span>
            <HandCoins className="h-5 w-5 text-orange-200" />
          </div>
          <p className="text-2xl font-bold">
            ${currentTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-orange-100 text-xs mt-1">{currentCount} {currentCount === 1 ? "pago" : "pagos"}</p>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Período anterior</span>
          </div>
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">
            ${previousTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-muted-foreground text-xs mt-1">Mismo número de días</p>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Variación</span>
          </div>
          <div className="flex items-center gap-2">
            {diffPositive ? <TrendingUp className="h-5 w-5 text-rose-500" /> :
             diffNegative ? <TrendingDown className="h-5 w-5 text-emerald-500" /> :
             <Minus className="h-5 w-5 text-slate-400" />}
            <p className={`text-2xl font-bold ${
              diffColor === "rose" ? "text-rose-600 dark:text-rose-400" :
              diffColor === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
              "text-slate-500"
            }`}>
              {diffPositive ? "+" : ""}{diffPct.toFixed(1)}%
            </p>
          </div>
          <p className="text-muted-foreground text-xs mt-1">vs período anterior</p>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Proveedores</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{uniqueSuppliers}</p>
          <p className="text-muted-foreground text-xs mt-1">Distintos pagados</p>
        </Card>
      </div>

      {/* Line chart acumulado */}
      <Card className="border-0 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-orange-500" /> Evolución acumulada de pagos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Del {moment(dateFrom).format("DD/MM/YYYY")} al {moment(dateTo).format("DD/MM/YYYY")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {diffPositive && (
              <Badge className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-0">
                ▲ Subida vs período anterior
              </Badge>
            )}
            {diffNegative && (
              <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-0">
                ▼ Bajada vs período anterior
              </Badge>
            )}
            <ExportMenu
              columns={SUPPLIER_PAYMENTS_COLUMNS}
              rows={chartData.map((d) => ({ fecha: d.date, diario: d.Diario, acumulado: d.Acumulado }))}
              filename="pagos_proveedores"
              title="Pagos a Proveedores"
            />
          </div>
        </div>

        {currentTotal === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-slate-400">
            <HandCoins className="h-12 w-12 opacity-30 mb-3" />
            <p className="text-sm">Sin pagos a proveedores en este rango de fechas</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="supplierGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
                formatter={(v, name) => [`$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, name]}
                labelFormatter={(l, payload) => payload?.[0]?.payload?.date || l}
              />
              <Area
                type="monotone"
                dataKey="Acumulado"
                stroke="#f97316"
                strokeWidth={2.5}
                fill="url(#supplierGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
