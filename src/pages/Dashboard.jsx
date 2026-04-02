import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Package, ArrowLeftRight, DollarSign, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import RecentMovements from "@/components/dashboard/RecentMovements";
import SalesFilterToggle from "@/components/dashboard/SalesFilterToggle";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import UnpaidDetailModal from "@/components/dashboard/UnpaidDetailModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unpaidModalOpen, setUnpaidModalOpen] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState("day");

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      const bId = u?.business_id;
      setIsAdmin(admin);
      const [prods, movs] = await Promise.all([
        base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
        base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
      ]);
      setProducts(prods);
      setMovements(movs);
      // Cargar cotizaciones para todos (para ventas del día)
      const quots = await base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 1000).catch(() => []);
      setQuotations(quots);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Forzar recalculación cuando cambia salesPeriod
  useEffect(() => {
    // Este efecto vacío asegura que salesData se recalcule
  }, [salesPeriod]);

  // Función centralizada para convertir UTC a timezone México (UTC-6, FIJO sin daylight saving)
  const convertUTCToLocalDate = (isoString) => {
    const utcDate = new Date(isoString);
    // México City siempre está en UTC-6 (sin cambio de horario)
    // Convertimos a milisegundos sumando 6 horas (6 * 60 * 60 * 1000)
    const mexicoDate = new Date(utcDate.getTime() + (6 * 60 * 60 * 1000));
    return mexicoDate;
  };

  // Función para obtener rango de fechas según período (timezone local)
  const getDateRange = (period) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const dayOfWeek = now.getDay();
    
    let start, end;
    
    switch (period) {
      case "day":
        start = new Date(year, month, date, 0, 0, 0, 0);
        end = new Date(year, month, date, 23, 59, 59, 999);
        break;
      case "week":
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(year, month, date - daysFromMonday);
        start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0);
        end = new Date(year, month, date, 23, 59, 59, 999);
        break;
      case "month":
        start = new Date(year, month, 1, 0, 0, 0, 0);
        end = new Date(year, month, date, 23, 59, 59, 999);
        break;
      case "year":
        start = new Date(year, 0, 1, 0, 0, 0, 0);
        end = new Date(year, month, date, 23, 59, 59, 999);
        break;
      default:
        start = new Date(year, month, date, 0, 0, 0, 0);
        end = new Date(year, month, date, 23, 59, 59, 999);
    }
    
    return { start, end };
  };

  // Calcular datos según período GLOBAL
  const { start: periodStart, end: periodEnd } = useMemo(() => getDateRange(salesPeriod), [salesPeriod]);

  // Filtrar todos los datos por período
  const periodMovements = useMemo(() => 
    movements.filter((m) => {
      const localDate = convertUTCToLocalDate(m.created_date);
      return localDate >= periodStart && localDate <= periodEnd;
    }),
    [movements, periodStart, periodEnd]
  );

  const periodQuotations = useMemo(() =>
    quotations.filter((q) => {
      const localDate = convertUTCToLocalDate(q.created_date);
      return localDate >= periodStart && localDate <= periodEnd;
    }),
    [quotations, periodStart, periodEnd]
  );

  // Stats dinámicos (NO filtrados, pero sí periódicos para ciertas métricas)
  const activeProducts = products.filter((p) => p.status === "active");
  const totalStock = activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValue = activeProducts.reduce((sum, p) => sum + (p.stock || 0) * (p.purchase_price || 0), 0);
  const lowStockProducts = activeProducts.filter((p) => p.stock <= (p.min_stock || 5));

  // Movimientos en período
  const periodMovementsCount = periodMovements.length;

  // Calcular ventas según período
  const salesData = useMemo(() => {
    const periodConvertedQuotations = periodQuotations.filter((q) => q.status === "converted");
    const periodExits = periodMovements.filter((m) => m.type === "exit");
    const periodDirectExits = periodExits.filter((m) => !m.quotation_id);

    const salesFromQuotations = periodConvertedQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const salesFromDirectExits = periodDirectExits.reduce((sum, m) => sum + (m.total || 0), 0);
    const salesRevenue = salesFromQuotations + salesFromDirectExits;
    
    const unpaidQuotations = periodConvertedQuotations.filter(q => !q.paid).reduce((sum, q) => sum + (q.total || 0), 0);
    const unpaidDirectExits = periodDirectExits.filter(m => !m.paid).reduce((sum, m) => sum + (m.total || 0), 0);
    const unpaidTotal = unpaidQuotations + unpaidDirectExits;
    const realRevenue = salesRevenue - unpaidTotal;

    const productLookup = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const salesCost = periodExits.reduce((sum, m) => {
      const costUnit = (m.cost_price != null && m.cost_price > 0)
        ? m.cost_price
        : (productLookup[m.product_id]?.purchase_price ?? 0);
      return sum + ((m.quantity || 0) * costUnit);
    }, 0);
    
    const profit = salesRevenue - salesCost;
    const margin = salesRevenue > 0 ? (profit / salesRevenue) * 100 : 0;
    const salesCount = periodConvertedQuotations.length + periodDirectExits.length;

    return {
      salesRevenue,
      realRevenue,
      salesCost,
      profit,
      margin,
      salesCount,
      periodExits,
      periodDirectExits,
      periodConvertedQuotations,
    };
  }, [periodMovements, periodQuotations, products]);

  // Cotizaciones concretadas sin pagar — GLOBAL (NO filtradas por período)
  const unpaidConverted = quotations.filter(q => q.status === "converted" && !q.paid);
  // Movimientos de salida directa sin pagar (sin quotation_id) — GLOBAL (NO filtradas por período)
  const unpaidDirectMovements = movements.filter(m => m.type === "exit" && !m.quotation_id && !m.paid);

  const unpaidCount = unpaidConverted.length + unpaidDirectMovements.length;
  const unpaidTotal =
    unpaidConverted.reduce((sum, q) => sum + (q.total || 0), 0) +
    unpaidDirectMovements.reduce((sum, m) => sum + (m.total || 0), 0);

  // Quotation semaphore counts — GLOBAL (NO filtrado por período, para visibilidad de todo)
  const quotGreen = quotations.filter(q => q.status === "converted").length;
  const quotYellow = quotations.filter(q => ["draft", "sent", "accepted"].includes(q.status)).length;
  const quotRed = quotations.filter(q => q.status === "cancelled").length;

  // Chart data: movements per day (dinámico según período)
  const chartData = useMemo(() => {
    const data = [];
    
    if (salesPeriod === "day") {
      // Para un día, mostrar horas
      for (let h = 0; h < 24; h += 4) {
        const hourMovements = periodMovements.filter((m) => {
          const d = convertUTCToLocalDate(m.created_date);
          return d.getHours() >= h && d.getHours() < (h + 4);
        });
        const entries = hourMovements.filter(m => m.type === "entry").reduce((s, m) => s + m.quantity, 0);
        const exits = hourMovements.filter(m => m.type === "exit").reduce((s, m) => s + m.quantity, 0);
        data.push({
          day: `${String(h).padStart(2, '0')}:00`,
          Entradas: entries,
          Salidas: exits,
        });
      }
    } else if (salesPeriod === "week") {
      // Para una semana, mostrar días
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
        const dayMovements = periodMovements.filter((m) => {
          const d = convertUTCToLocalDate(m.created_date);
          return d >= dayStart && d <= dayEnd;
        });
        const entries = dayMovements.filter(m => m.type === "entry").reduce((s, m) => s + m.quantity, 0);
        const exits = dayMovements.filter(m => m.type === "exit").reduce((s, m) => s + m.quantity, 0);
        data.push({
          day: date.toLocaleDateString("es-MX", { weekday: "short" }),
          Entradas: entries,
          Salidas: exits,
        });
      }
    } else if (salesPeriod === "month") {
      // Para un mes, mostrar semanas
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      let weekStart = new Date(monthStart);
      let week = 1;
      while (weekStart <= monthEnd) {
        const weekEndDate = new Date(weekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekMovements = periodMovements.filter((m) => {
          const d = convertUTCToLocalDate(m.created_date);
          return d >= weekStart && d <= weekEndDate;
        });
        const entries = weekMovements.filter(m => m.type === "entry").reduce((s, m) => s + m.quantity, 0);
        const exits = weekMovements.filter(m => m.type === "exit").reduce((s, m) => s + m.quantity, 0);
        data.push({
          day: `Sem ${week}`,
          Entradas: entries,
          Salidas: exits,
        });
        weekStart.setDate(weekStart.getDate() + 7);
        week++;
      }
    } else {
      // Para un año, mostrar meses
      const now = new Date();
      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(now.getFullYear(), m, 1);
        const monthEnd = new Date(now.getFullYear(), m + 1, 0);
        const monthMovements = periodMovements.filter((mov) => {
          const d = convertUTCToLocalDate(mov.created_date);
          return d >= monthStart && d <= monthEnd;
        });
        const entries = monthMovements.filter(mov => mov.type === "entry").reduce((s, mov) => s + mov.quantity, 0);
        const exits = monthMovements.filter(mov => mov.type === "exit").reduce((s, mov) => s + mov.quantity, 0);
        data.push({
          day: monthStart.toLocaleDateString("es-MX", { month: "short" }),
          Entradas: entries,
          Salidas: exits,
        });
      }
    }
    
    return data;
  }, [salesPeriod, periodMovements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* FILTRO GLOBAL EN TOP */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/30 dark:to-cyan-950/30 backdrop-blur-sm border-b border-indigo-200 dark:border-indigo-900 rounded-lg p-4 mb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Período de análisis</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Todos los datos se filtran por este período</p>
          </div>
          <SalesFilterToggle period={salesPeriod} onPeriodChange={setSalesPeriod} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Productos"
          value={activeProducts.length}
          subtitle={`${totalStock} unidades en stock`}
          icon={Package}
          color="indigo"
          href={createPageUrl("Products")}
        />
        {isAdmin && (
          <StatCard
            title="Valor Total"
            value={`$${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
            subtitle="Al costo de compra"
            icon={DollarSign}
            color="emerald"
            href={createPageUrl("Reports")}
          />
        )}
        <StatCard
          title="Movimientos"
          value={periodMovementsCount}
          subtitle={`${["day", "week", "month", "year"].includes(salesPeriod) ? { day: "Hoy", week: "Esta semana", month: "Este mes", year: "Este año" }[salesPeriod] : "En período"}`}
          icon={ArrowLeftRight}
          color="cyan"
          href={createPageUrl("Movements")}
        />
        <StatCard
          title="Stock Bajo"
          value={lowStockProducts.length}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          color={lowStockProducts.length > 0 ? "amber" : "emerald"}
          href={createPageUrl("Products") + "?filter=low_stock"}
        />
      </div>

      {/* Cobro pendiente — cotizaciones concretadas sin pagar */}
      <UnpaidDetailModal
        open={unpaidModalOpen}
        onOpenChange={setUnpaidModalOpen}
        unpaidConverted={unpaidConverted}
        unpaidDirectMovements={unpaidDirectMovements}
      />
      {unpaidCount > 0 && (
        <button
          onClick={() => setUnpaidModalOpen(true)}
          className="w-full text-left"
        >
          <Card className="border-0 shadow-sm p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold text-orange-800 dark:text-orange-300 text-sm">
                    {unpaidCount} {unpaidCount === 1 ? "venta sin cobrar" : "ventas sin cobrar"}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    {unpaidConverted.length > 0 && `${unpaidConverted.length} cotización(es)`}
                    {unpaidConverted.length > 0 && unpaidDirectMovements.length > 0 && " · "}
                    {unpaidDirectMovements.length > 0 && `${unpaidDirectMovements.length} movimiento(s) directo(s)`}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-orange-600 dark:text-orange-400">Pendiente por cobrar</p>
                <p className="font-bold text-orange-700 dark:text-orange-300 text-lg">
                  ${unpaidTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </Card>
        </button>
      )}

      {/* Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
       <Card className="border-0 shadow-sm p-5 hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5" onClick={() => navigate(`${createPageUrl("Movements")}?type=exit`)}>
         <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
           <TrendingUp className="h-4 w-4 text-indigo-500" /> Ventas
         </h3>
            {salesData.salesRevenue === 0 ? (
             <p className="text-sm text-slate-400 py-4 text-center">Sin ventas registradas en este período</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Monto vendido</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">${salesData.salesRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-950/40 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Cobrado</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">${salesData.realRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                {isAdmin && (
                  <>
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Costo de lo vendido</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">${salesData.salesCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Ganancia bruta</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">${salesData.profit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                        <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-0 text-xs">{salesData.margin.toFixed(1)}%</Badge>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
        </Card>

        {/* Quotation Semaphore */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Semáforo de Cotizaciones</h3>
          <div className="space-y-3">
            <button onClick={() => navigate(`${createPageUrl("Quotations")}?status=converted`)} className="w-full text-left flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-4 py-2.5 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Concretadas en venta</span>
              </div>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{quotGreen}</span>
            </button>
            <button onClick={() => navigate(`${createPageUrl("Quotations")}?status=active`)} className="w-full text-left flex justify-between items-center bg-amber-50 dark:bg-amber-950/40 rounded-lg px-4 py-2.5 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400 inline-block" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Sin concretar (activas)</span>
              </div>
              <span className="font-bold text-amber-400 dark:text-amber-300 text-lg">{quotYellow}</span>
            </button>
            <button onClick={() => navigate(`${createPageUrl("Quotations")}?status=cancelled`)} className="w-full text-left flex justify-between items-center bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2.5 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 inline-block" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Canceladas</span>
              </div>
              <span className="font-bold text-red-500 dark:text-red-300 text-lg">{quotRed}</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Charts and alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Movimientos (Últimos 7 días)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              />
              <Bar dataKey="Entradas" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Salidas" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <div className="space-y-6">
          <LowStockAlert products={lowStockProducts} />
          <RecentMovements movements={movements} />
        </div>
      </div>
    </div>
  );
}