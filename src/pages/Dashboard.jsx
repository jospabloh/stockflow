import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, ArrowLeftRight, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
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

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      setIsAdmin(admin);
      const [prods, movs] = await Promise.all([
        base44.entities.Product.list("-created_date", 500),
        base44.entities.Movement.list("-created_date", 200),
      ]);
      setProducts(prods);
      setMovements(movs);
      if (admin) {
        const quots = await base44.entities.Quotation.list("-created_date", 200).catch(() => []);
        setQuotations(quots);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeProducts = products.filter((p) => p.status === "active");
  const totalStock = activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValue = activeProducts.reduce((sum, p) => sum + (p.stock || 0) * (p.purchase_price || 0), 0);
  const lowStockProducts = activeProducts.filter((p) => p.stock <= (p.min_stock || 5));

  const today = new Date().toDateString();
  const todayMovements = movements.filter((m) => new Date(m.created_date).toDateString() === today);

  // Today's sales breakdown
  const todayExits = todayMovements.filter((m) => m.type === "exit");
  const todaySalesRevenue = todayExits.reduce((sum, m) => sum + (m.total || 0), 0);
  const todaySalesCost = todayExits.reduce((sum, m) => {
    const prod = products.find(p => p.id === m.product_id);
    return sum + (m.quantity || 0) * (prod?.purchase_price || 0);
  }, 0);
  const todayProfit = todaySalesRevenue - todaySalesCost;
  const todayMargin = todaySalesRevenue > 0 ? (todayProfit / todaySalesRevenue) * 100 : 0;

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

      {/* Today's Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link to={createPageUrl("Movements")} className="block">
          <Card className="border-0 shadow-sm p-5 hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Ventas del Día
            </h3>
            {todayExits.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Sin ventas registradas hoy</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-blue-50 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-slate-600">Monto vendido</span>
                  <span className="font-bold text-blue-700">${todaySalesRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
                {isAdmin && (
                  <>
                    <div className="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600">Costo de lo vendido</span>
                      <span className="font-bold text-slate-700">${todaySalesCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600">Ganancia bruta</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700">${todayProfit.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">{todayMargin.toFixed(1)}%</Badge>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </Link>

        {/* Quotation Semaphore */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Semáforo de Cotizaciones</h3>
          <div className="space-y-3">
            <Link to={createPageUrl("Quotations")} className="flex justify-between items-center bg-emerald-50 rounded-lg px-4 py-2.5 hover:bg-emerald-100 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-sm text-slate-600">Concretadas en venta</span>
              </div>
              <span className="font-bold text-emerald-700 text-lg">{quotGreen}</span>
            </Link>
            <Link to={createPageUrl("Quotations")} className="flex justify-between items-center bg-amber-50 rounded-lg px-4 py-2.5 hover:bg-amber-100 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400 inline-block" />
                <span className="text-sm text-slate-600">Sin concretar (activas)</span>
              </div>
              <span className="font-bold text-amber-600 text-lg">{quotYellow}</span>
            </Link>
            <Link to={createPageUrl("Quotations")} className="flex justify-between items-center bg-red-50 rounded-lg px-4 py-2.5 hover:bg-red-100 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 inline-block" />
                <span className="text-sm text-slate-600">Canceladas</span>
              </div>
              <span className="font-bold text-red-600 text-lg">{quotRed}</span>
            </Link>
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