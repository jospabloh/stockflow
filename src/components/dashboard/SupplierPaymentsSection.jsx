import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { HandCoins, Crown, ArrowRight } from "lucide-react";

// Convierte UTC a timezone México (UTC-6 fijo, sin DST) — coincide con Dashboard.jsx
const toMexicoDate = (iso) => {
  const utc = new Date(iso);
  return new Date(utc.getTime() - 6 * 60 * 60 * 1000);
};

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || "").join("");
};

/**
 * Sección gráfica de pagos a proveedores del Dashboard.
 * Respeta el filtro global de período (day/week/month/year/custom).
 *
 * Props:
 *  - payments: SupplierPayment[] ya filtrados al período
 *  - salesPeriod: "day" | "week" | "month" | "year" | null (cuando hay customRange)
 *  - periodStartStr / periodEndStr: YYYY-MM-DD del rango actual
 */
export default function SupplierPaymentsSection({ payments = [], salesPeriod = "day", periodStartStr, periodEndStr }) {
  const total = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
  const count = payments.length;

  // Top 5 proveedores en el período
  const topSuppliers = useMemo(() => {
    const map = new Map();
    payments.forEach(p => {
      const key = p.supplier_id || p.supplier_name || "unknown";
      const entry = map.get(key) || { name: p.supplier_name || "—", total: 0, count: 0 };
      entry.total += Number(p.amount) || 0;
      entry.count += 1;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [payments]);

  // Serie temporal dinámica según período seleccionado.
  // payment_date es YYYY-MM-DD ya en tz local, así que agrupamos por ese string.
  const chartData = useMemo(() => {
    // Parse YYYY-MM-DD to Date (local)
    const parseDate = (str) => {
      if (!str) return null;
      const [y, m, d] = str.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

    // Agrupar pagos por su payment_date
    const byDate = new Map();
    payments.forEach(p => {
      const d = p.payment_date;
      if (!d) return;
      byDate.set(d, (byDate.get(d) || 0) + (Number(p.amount) || 0));
    });

    const start = parseDate(periodStartStr);
    const end = parseDate(periodEndStr);

    const data = [];
    if (salesPeriod === "day" || (start && end && start.getTime() === end.getTime())) {
      // Para un solo día, como los pagos son por fecha (no timestamp), mostramos 1 sola barra
      const key = periodStartStr;
      data.push({ label: "Hoy", Pagos: byDate.get(key) || 0 });
    } else if (salesPeriod === "week") {
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = fmt(d.getFullYear(), d.getMonth(), d.getDate());
        data.push({
          label: d.toLocaleDateString("es-MX", { weekday: "short" }),
          Pagos: byDate.get(key) || 0,
        });
      }
    } else if (salesPeriod === "month") {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let w = 0; w < Math.ceil(lastDay / 7); w++) {
        const weekStart = w * 7 + 1;
        const weekEnd = Math.min(weekStart + 6, lastDay);
        let weekTotal = 0;
        for (let day = weekStart; day <= weekEnd; day++) {
          const key = fmt(year, month, day);
          weekTotal += byDate.get(key) || 0;
        }
        data.push({ label: `Sem ${w + 1}`, Pagos: weekTotal });
      }
    } else if (salesPeriod === "year") {
      const year = new Date().getFullYear();
      for (let m = 0; m < 12; m++) {
        let monthTotal = 0;
        const lastDay = new Date(year, m + 1, 0).getDate();
        for (let day = 1; day <= lastDay; day++) {
          const key = fmt(year, m, day);
          monthTotal += byDate.get(key) || 0;
        }
        data.push({
          label: new Date(year, m, 1).toLocaleDateString("es-MX", { month: "short" }),
          Pagos: monthTotal,
        });
      }
    } else if (start && end) {
      // Custom range: granularidad diaria
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = fmt(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        data.push({
          label: `${pad(cursor.getDate())}/${pad(cursor.getMonth() + 1)}`,
          Pagos: byDate.get(key) || 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return data;
  }, [payments, salesPeriod, periodStartStr, periodEndStr]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* BarChart temporal */}
      <Card className="lg:col-span-2 border-0 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-orange-500" />
              Pagos a Proveedores
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">En el período seleccionado</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground">{count} {count === 1 ? "pago" : "pagos"}</p>
          </div>
        </div>

        {count === 0 ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <HandCoins className="h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm">Sin pagos a proveedores en este período</p>
            <Link
              to={createPageUrl("SupplierPayments")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-flex items-center gap-1"
            >
              Registrar el primero <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
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
                formatter={(v) => [`$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, "Pagos"]}
              />
              <Bar dataKey="Pagos" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Top proveedores */}
      <Card className="border-0 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Top Proveedores
          </h3>
          <Link
            to={createPageUrl("SupplierPayments")}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {topSuppliers.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Sin pagos en este período</p>
        ) : (
          <div className="space-y-2">
            {topSuppliers.map((s, i) => {
              const pct = total > 0 ? (s.total / total) * 100 : 0;
              return (
                <div key={`${s.name}-${i}`} className="group">
                  <div className="flex items-center gap-3 py-1.5">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                      i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400" :
                      i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-500" :
                      "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600"
                    }`}>
                      {initials(s.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={s.name}>
                          {s.name}
                        </p>
                        <p className="text-sm font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                          ${s.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="h-4 text-[10px] px-1.5 font-normal">
                          {s.count}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
