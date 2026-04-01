import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, ArrowLeftRight, DollarSign, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import RecentMovements from "@/components/dashboard/RecentMovements";
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

  const activeProducts = products.filter((p) => p.status === "active");
  const totalStock = activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValue = activeProducts.reduce((sum, p) => sum + (p.stock || 0) * (p.purchase_price || 0), 0);
  const lowStockProducts = activeProducts.filter((p) => p.stock <= (p.min_stock || 5));

  const today = new Date().toDateString();
  const todayMovements = movements.filter((m) => new Date(m.created_date).toDateString() === today);

  // Ventas del día = cotizaciones convertidas hoy + movimientos de salida directos (sin quotation_id)
  const todayConvertedQuotations = quotations.filter(
    (q) => q.status === "converted" && new Date(q.created_date).toDateString() === today
  );
  const todayExits = todayMovements.filter((m) => m.type === "exit");
  const todayDirectExits = todayExits.filter((m) => !m.quotation_id); // salidas manuales, no de cotizaciones

  const todaySalesFromQuotations = todayConvertedQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
  const todaySalesFromDirectExits = todayDirectExits.reduce((sum, m) => sum + (m.total || 0), 0);
  const todaySalesRevenue = todaySalesFromQuotations + todaySalesFromDirectExits;
  
  // Venta real = ventas - pendiente de pago (cotizaciones no pagadas + movimientos directos no pagados)
  const todayUnpaidQuotations = todayConvertedQuotations.filter(q => !q.paid).reduce((sum, q) => sum + (q.total || 0), 0);
  const todayUnpaidDirectExits = todayDirectExits.filter(m => !m.paid).reduce((sum, m) => sum + (m.total || 0), 0);
  const todayUnpaidTotal = todayUnpaidQuotations + todayUnpaidDirectExits;
  const todayRealRevenue = todaySalesRevenue - todayUnpaidTotal;

  const productLookup = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  const todaySalesCost = todayExits.reduce((sum, m) => {
    const costUnit = (m.cost_price != null && m.cost_price > 0)
      ? m.cost_price
      : (productLookup[m.product_id]?.purchase_price ?? 0);
    return sum + ((m.quantity || 0) * costUnit);
  }, 0);
  const todayProfit = todaySalesRevenue - todaySalesCost;
  const todayMargin = todaySalesRevenue > 0 ? (todayProfit / todaySalesRevenue) * 100 : 0;
  const todaySalesCount = todayConvertedQuotations.length + todayDirectExits.length;

  // Cotizaciones concretadas sin pagar
  const unpaidConverted = quotations.filter(q => q.status === "converted" && !q.paid);
  // Movimientos de salida directa sin pagar (sin quotation_id)
  const unpaidDirectMovements = movements.filter(m => m.type === "exit" && !m.quotation_id && !m.paid);

  const unpaidCount = unpaidConverted.length + unpaidDirectMovements.length;
  const unpaidTotal =
    unpaidConverted.reduce((sum, q) => sum + (q.total || 0), 0) +
    unpaidDirectMovements.reduce((sum, m) => sum + (m.total || 0), 0);

  // Quotation semaphore counts
  const quotGreen = quotations.filter(q => q.status === "converted").length;
  const quotYellow = quotations.filter(q => ["draft", "sent", "accepted"].includes(q.status)).length;
  const quotRed = quotations.filter(q => q.status === "cancelled").length;

  // Chart data: movements per day (last 7 days)
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();
    const dayMovements = movements.filter(
      (m) => new Date(m.created_date).toDateString() === dateStr
    );
    const entries = dayMovements.filter((m) => m.type === "entry").reduce((s, m) => s + m.quantity, 0);
    const exits = dayMovements.filter((m) => m.type === "exit").reduce((s, m) => s + m.quantity, 0);
    chartData.push({
      day: date.toLocaleDateString("es-MX", { weekday: "short" }),
      Entradas: entries,
      Salidas: exits,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
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
          title="Movimientos Hoy"
          value={todayMovements.length}
          subtitle="Entradas y salidas"
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

      {/* Today's Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm p-5 hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5" onClick={() => navigate(`${createPageUrl("Movements")}?type=exit`)}>
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" /> Ventas del Día
          </h3>
            {todaySalesCount === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Sin ventas registradas hoy</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Monto vendido</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">${todaySalesRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-950/40 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Cobrado</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">${todayRealRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                {isAdmin && (
                  <>
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Costo de lo vendido</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">${todaySalesCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Ganancia bruta</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">${todayProfit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                        <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-0 text-xs">{todayMargin.toFixed(1)}%</Badge>
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