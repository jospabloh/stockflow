import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { Package, ArrowLeftRight, DollarSign, AlertTriangle, TrendingUp, Clock, HandCoins } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import RecentMovements from "@/components/dashboard/RecentMovements";
import SalesFilterToggle from "@/components/dashboard/SalesFilterToggle";
import SupplierPaymentsSection from "@/components/dashboard/SupplierPaymentsSection";
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

// Función para obtener rango de fechas según período (México City timezone, respeta DST)
function getDateRange(period) {
  const now = new Date();
  const TZ = 'America/Mexico_City';

  // Obtener año, mes, día y día-de-semana en timezone México
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short'
  }).formatToParts(now);

  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });

  const year = parseInt(p.year);
  const month = parseInt(p.month) - 1; // 0-indexed
  const day = parseInt(p.day);
  // weekday: Sun, Mon, Tue, Wed, Thu, Fri, Sat
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = weekdayMap[p.weekday] ?? 0;

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const today = fmt(year, month, day);

  let startStr, endStr;

  switch (period) {
    case "day":
      startStr = today;
      endStr = today;
      break;
    case "week": {
      // Lunes de esta semana
      const daysFromMonday = dow === 0 ? 6 : dow - 1;
      const mondayDate = new Date(year, month, day - daysFromMonday);
      startStr = fmt(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate());
      endStr = today;
      break;
    }
    case "month":
      startStr = fmt(year, month, 1);
      endStr = today;
      break;
    case "year":
      startStr = fmt(year, 0, 1);
      endStr = today;
      break;
    default:
      startStr = today;
      endStr = today;
  }

  return { startStr, endStr };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { canSee } = useFieldVisibility("Dashboard");
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unpaidModalOpen, setUnpaidModalOpen] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState("day");
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      const bId = u?.business_id;
      setIsAdmin(admin);
      const [prods, movs, pays] = await Promise.all([
        base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
        base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
        base44.entities.SupplierPayment.filter({ business_id: bId }, "-payment_date", 1000).catch(() => []),
      ]);
      setProducts(prods);
      setMovements(movs);
      setSupplierPayments(pays);
      // Cargar cotizaciones para todos (para ventas del día)
      const quots = await base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 1000).catch(() => []);
      setQuotations(quots);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Función centralizada para convertir UTC a timezone México (UTC-6, FIJO sin daylight saving)
  const convertUTCToLocalDate = (isoString) => {
    const utcDate = new Date(isoString);
    // México City siempre está en UTC-6 (sin cambio de horario)
    const mexicoDate = new Date(utcDate.getTime() - (6 * 60 * 60 * 1000));
    return mexicoDate;
  };

  // Helper: Convert date to YYYY-MM-DD string in Mexico timezone
  const getDateStringMexico = (isoString) => {
    const localDate = convertUTCToLocalDate(isoString);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calcular datos según período GLOBAL (usar custom range si está definido)
  const { startStr: periodStartStr, endStr: periodEndStr } = useMemo(() => {
    if (customDateRange.start && customDateRange.end) {
      return { startStr: customDateRange.start, endStr: customDateRange.end };
    }
    return getDateRange(salesPeriod);
  }, [salesPeriod, customDateRange]);

  // Filtrar todos los datos por período (usando date strings)
  const periodMovements = useMemo(() => 
    movements.filter((m) => {
      const dateStr = getDateStringMexico(m.created_date);
      return dateStr >= periodStartStr && dateStr <= periodEndStr;
    }),
    [movements, periodStartStr, periodEndStr]
  );

  const periodQuotations = useMemo(() =>
    quotations.filter((q) => {
      const dateStr = getDateStringMexico(q.created_date);
      return dateStr >= periodStartStr && dateStr <= periodEndStr;
    }),
    [quotations, periodStartStr, periodEndStr]
  );

  // payment_date viene ya como YYYY-MM-DD en timezone local, comparación directa de strings
  const periodSupplierPayments = useMemo(() =>
    supplierPayments.filter((p) => {
      const d = p.payment_date || "";
      return d >= periodStartStr && d <= periodEndStr;
    }),
    [supplierPayments, periodStartStr, periodEndStr]
  );

  const isLowStockProduct = (product) => {
    if (!product || product.status !== "active") return false;

    const stock = Number(product.stock ?? 0);
    const minStock = Number(product.min_stock);

    if (!Number.isFinite(minStock)) return false;

    return stock <= minStock;
  };

  // Stats dinámicos
  const activeProducts = products.filter((p) => p.status === "active");
  const totalStock = activeProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const totalValue = activeProducts.reduce(
    (sum, p) => sum + (Number(p.stock) || 0) * (Number(p.purchase_price) || 0),
    0
  );
  const lowStockProducts = activeProducts.filter(isLowStockProduct);

  // Movimientos en período
  const periodMovementsCount = periodMovements.length;

  // Calcular ventas según período
  const salesData = useMemo(() => {
    const periodConvertedQuotations = periodQuotations.filter((q) => q.status === "converted");
    const periodExits = periodMovements.filter((m) => m.type === "exit");
    const periodDirectExits = periodExits.filter((m) => m && !m.quotation_id);

    const salesFromQuotations = periodConvertedQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const salesFromDirectExits = periodDirectExits.reduce((sum, m) => sum + (m.total || 0), 0);
    const cancelledQuotationIds = new Set(
      quotations.filter(q => q.status === "cancelled").map(q => q.id)
    );

    const periodReturnsRevenue = periodMovements.filter(m =>
      m.type === "return" && m.quotation_id && !cancelledQuotationIds.has(m.quotation_id)
    ).reduce((sum, m) => sum + (m.total || 0), 0);
    const salesRevenue = salesFromQuotations + salesFromDirectExits - periodReturnsRevenue;
    
    const unpaidQuotations = periodConvertedQuotations.filter(q => !q.paid).reduce((sum, q) => sum + (q.total || 0), 0);
    const unpaidDirectExits = periodDirectExits.filter(m => !m.paid).reduce((sum, m) => sum + (m.total || 0), 0);
    const unpaidTotal = unpaidQuotations + unpaidDirectExits;
    const realRevenue = salesRevenue - unpaidTotal;

    const undeliveredQuotations = periodConvertedQuotations.filter(q => !q.delivered);
    const undeliveredTotal = undeliveredQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const undeliveredItems = undeliveredQuotations.reduce((sum, q) => sum + (q.items?.length || 0), 0);

    const productLookup = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

    const validExits = periodExits.filter(m => !m.quotation_id || !cancelledQuotationIds.has(m.quotation_id));
    const periodReturns = periodMovements.filter(m => m.type === "return" && m.quotation_id && !cancelledQuotationIds.has(m.quotation_id));

    const salesCost = validExits.reduce((sum, m) => {
      const costUnit = (m.cost_price != null && m.cost_price > 0)
        ? m.cost_price
        : (productLookup[m.product_id]?.purchase_price ?? 0);
      return sum + ((m.quantity || 0) * costUnit);
    }, 0) - periodReturns.reduce((sum, m) => {
      const costUnit = (m.cost_price != null && m.cost_price > 0)
        ? m.cost_price
        : (productLookup[m.product_id]?.purchase_price ?? 0);
      return sum + ((m.quantity || 0) * costUnit);
    }, 0);
    
    const actualProfit = realRevenue - salesCost;
    const actualMargin = realRevenue > 0 ? (actualProfit / realRevenue) * 100 : 0;

    const potentialProfit = salesRevenue - salesCost;
    const potentialMargin = salesRevenue > 0 ? (potentialProfit / salesRevenue) * 100 : 0;
    const salesCount = periodConvertedQuotations.length + periodDirectExits.length;

    const supplierPaymentsTotal = periodSupplierPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const netProfit = actualProfit - supplierPaymentsTotal;
    const netMargin = realRevenue > 0 ? (netProfit / realRevenue) * 100 : 0;
    // % de utilidad real consumida por pagos a proveedores (solo cuando hay utilidad positiva)
    const supplierImpactPct = actualProfit > 0 ? (supplierPaymentsTotal / actualProfit) * 100 : 0;

    return {
      salesRevenue,
      realRevenue,
      salesCost,
      actualProfit,
      actualMargin,
      potentialProfit,
      potentialMargin,
      salesCount,
      periodExits,
      periodDirectExits,
      periodConvertedQuotations,
      undeliveredTotal,
      undeliveredItems,
      supplierPaymentsTotal,
      netProfit,
      netMargin,
      supplierImpactPct,
    };
  }, [periodMovements, periodQuotations, periodSupplierPayments, products]);

  // Cotizaciones concretadas sin pagar — GLOBAL
  const unpaidConverted = quotations.filter(q => q.status === "converted" && !q.paid);
  const unpaidDirectMovements = movements.filter(m => m.type === "exit" && !m.quotation_id && !m.paid);

  const unpaidCount = unpaidConverted.length + unpaidDirectMovements.length;
  const unpaidTotal =
    unpaidConverted.reduce((sum, q) => sum + (q.total || 0), 0) +
    unpaidDirectMovements.reduce((sum, m) => sum + (m.total || 0), 0);

  // Quotation semaphore counts — últimos 30 días
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
  
  const quotationsLast30Days = quotations.filter(q => {
    const dateStr = getDateStringMexico(q.created_date);
    return dateStr >= thirtyDaysAgoStr;
  });
  
  const quotGreen = quotationsLast30Days.filter(q => q.status === "converted").length;
  const quotYellow = quotationsLast30Days.filter(q => ["draft", "sent", "accepted"].includes(q.status)).length;
  const quotRed = quotationsLast30Days.filter(q => q.status === "cancelled").length;
  
  const overduePaidQuotations = quotations.filter(q => {
    const dateStr = getDateStringMexico(q.created_date);
    return dateStr < thirtyDaysAgoStr && q.status === "converted" && !q.paid;
  });

  // Chart data: movements per day (dinámico según período)
  const chartData = useMemo(() => {
    const data = [];
    
    if (salesPeriod === "day") {
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

  const chartTitle = customDateRange.start && customDateRange.end
    ? "Movimientos — Período personalizado"
    : ({ day: "Movimientos — Hoy", week: "Movimientos — Esta semana", month: "Movimientos — Este mes", year: "Movimientos — Este año" }[salesPeriod] ?? "Movimientos");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* FILTRO GLOBAL EN TOP */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/30 dark:to-cyan-950/30 backdrop-blur-sm border-b border-indigo-200 dark:border-indigo-900 rounded-lg p-3 md:p-4 mb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Período de análisis</p>
            <p className="hidden sm:block text-sm text-slate-600 dark:text-slate-400 mt-1">Todos los datos se filtran por este período</p>
          </div>
          <SalesFilterToggle 
            period={salesPeriod} 
            onPeriodChange={setSalesPeriod} 
            startStr={periodStartStr} 
            endStr={periodEndStr}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
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
        {canSee("total_stock_value") && (
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

      {/* Cobro pendiente */}
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

      {/* Alerta de Cobranza Vencida */}
      {overduePaidQuotations.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 dark:text-red-200 text-sm">Cobranza Vencida</h4>
              <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                {overduePaidQuotations.length} {overduePaidQuotations.length === 1 ? 'cotización' : 'cotizaciones'} concretadas sin cobrar de hace más de 30 días. Requieren seguimiento urgente.
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-2">
                Total: ${overduePaidQuotations.reduce((sum, q) => sum + (q.total || 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
              <Link to={createPageUrl("Quotations")} className="text-red-600 dark:text-red-400 hover:underline text-xs font-medium mt-2 inline-block">
                Ver cotizaciones →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Sales Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
       <Card className="border-0 shadow-sm p-4 md:p-5">
         <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
           <TrendingUp className="h-4 w-4 text-indigo-500" /> Análisis de Ventas
         </h3>
            {salesData.salesRevenue === 0 ? (
             <p className="text-sm text-slate-400 py-4 text-center">Sin movimientos en este período</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Vendido</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">${salesData.salesRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-500">
                  <span>↳ Pendiente de cobrar</span>
                  <span className="font-semibold">${(salesData.salesRevenue - salesData.realRevenue).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-950/40 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Cobrado efectivamente</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">${salesData.realRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                {salesData.undeliveredTotal > 0 && (
                  <div className="flex justify-between items-center bg-cyan-50 dark:bg-cyan-950/40 rounded-lg px-4 py-2.5 border border-cyan-200 dark:border-cyan-800">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Vendido x entregar</span>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold text-cyan-700 dark:text-cyan-300 block">${salesData.undeliveredTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400">{salesData.undeliveredItems} {salesData.undeliveredItems === 1 ? 'item' : 'items'}</span>
                      </div>
                    </div>
                  </div>
                )}
                {canSee("net_profit") && (
                   <>
                      {canSee("cost_breakdown") && (
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Costo de lo entregado</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">${salesData.salesCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                      </div>
                      )}
                      {canSee("profit_metrics") && (<div className={`flex justify-between items-center rounded-lg px-4 py-2.5 ${salesData.actualMargin >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/40"}`}>
                        <span className={`text-sm font-semibold ${salesData.actualMargin >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>Utilidad Real</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${salesData.actualMargin >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                            {salesData.actualMargin >= 0 ? "+" : ""}{salesData.actualProfit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          <Badge className={`border-0 text-xs font-semibold ${salesData.actualMargin >= 0 ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"}`}>
                            {salesData.actualMargin >= 0 ? "+" : ""}{salesData.actualMargin.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      )}
                      {/* Pagos a proveedores del período */}
                      {canSee("supplier_impact") && (
                      <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-950/30 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <HandCoins className="h-3.5 w-3.5 text-orange-500" /> Pagos a proveedores
                        </span>
                        <Link
                          to={createPageUrl("SupplierPayments")}
                          className="font-bold text-orange-700 dark:text-orange-400 hover:underline"
                        >
                          −${salesData.supplierPaymentsTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </Link>
                      </div>
                      )}
                      {/* Utilidad Neta */}
                      <div className={`flex justify-between items-center rounded-lg px-4 py-2.5 border-t-2 ${salesData.netMargin >= 0 ? "bg-emerald-100/70 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800" : "bg-red-100/70 dark:bg-red-950/60 border-red-300 dark:border-red-800"}`}>
                        <span className={`text-sm font-bold ${salesData.netMargin >= 0 ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
                          Utilidad Neta <span className="text-[10px] font-normal opacity-70">(− prov.)</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${salesData.netMargin >= 0 ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
                            {salesData.netMargin >= 0 ? "+" : ""}{salesData.netProfit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          {salesData.supplierPaymentsTotal > 0 && salesData.actualProfit > 0 && (
                            <Badge className={`border-0 text-xs font-semibold ${
                              salesData.supplierImpactPct < 30
                                ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                : salesData.supplierImpactPct <= 50
                                ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                                : "bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300"
                            }`} title={`${salesData.supplierImpactPct.toFixed(1)}% de la utilidad se destinó a pagos a proveedores`}>
                              {salesData.supplierImpactPct.toFixed(1)}% consumido
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}
              </div>
            )}
       </Card>

        {/* Quotation Semaphore */}
        <Card className="border-0 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Semáforo de Cotizaciones</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Últimos 30 días</span>
          </div>
          <div className="space-y-2.5">
            <button onClick={() => navigate(`${createPageUrl("Quotations")}?status=converted`)} className="w-full text-left flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-4 py-3 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Concretadas en venta</span>
              </div>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xl">{quotGreen}</span>
            </button>
            <button onClick={() => navigate(`${createPageUrl("Quotations")}?status=active`)} className="w-full text-left flex justify-between items-center bg-amber-50 dark:bg-amber-950/40 rounded-lg px-4 py-3 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400 inline-block" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Sin concretar (activas)</span>
              </div>
              <span className="font-bold text-amber-400 dark:text-amber-300 text-xl">{quotYellow}</span>
            </button>
            <button onClick={() => navigate(`${createPageUrl("Quotations")}?status=cancelled`)} className="w-full text-left flex justify-between items-center bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-3 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 inline-block" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Canceladas</span>
              </div>
              <span className="font-bold text-red-500 dark:text-red-300 text-xl">{quotRed}</span>
            </button>
          </div>
          {quotationsLast30Days.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Tasa de conversión</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {((quotGreen / quotationsLast30Days.length) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden gap-px bg-slate-100 dark:bg-slate-800">
                {quotGreen > 0 && (
                  <div className="bg-emerald-400 rounded-l-full transition-all" style={{ flex: quotGreen }} />
                )}
                {quotYellow > 0 && (
                  <div className="bg-amber-400 transition-all" style={{ flex: quotYellow }} />
                )}
                {quotRed > 0 && (
                  <div className="bg-red-400 rounded-r-full transition-all" style={{ flex: quotRed }} />
                )}
              </div>
              <div className="mt-3 flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">{quotationsLast30Days.length} cotización(es) total</span>
                <Link to={createPageUrl("Quotations")} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  Ver todas →
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Charts and alerts */}
      {canSee("chart_visualization") && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2 border-0 shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{chartTitle}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500 inline-block" />
                Entradas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500 inline-block" />
                Salidas
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#f1f5f9"} />
              <XAxis dataKey="day" tick={{ fill: isDark ? "#64748b" : "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: isDark ? "#64748b" : "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#1e293b" : "white",
                  border: isDark ? "1px solid #334155" : "none",
                  borderRadius: "12px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                  color: isDark ? "#e2e8f0" : "#1e293b",
                }}
              />
              <Bar dataKey="Entradas" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Salidas" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <div className="space-y-4">
          {canSee("low_stock") && <LowStockAlert products={lowStockProducts} />}
          {canSee("recent_movements") && <RecentMovements movements={movements} />}
        </div>
        </div>
        )}

        {/* Sección gráfica: Pagos a Proveedores */}
        {canSee("supplier_payments") && (
        <SupplierPaymentsSection
          payments={periodSupplierPayments}
          salesPeriod={customDateRange.start && customDateRange.end ? null : salesPeriod}
          periodStartStr={periodStartStr}
          periodEndStr={periodEndStr}
        />
        )}
        </div>
        );
        }