import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, ArrowLeftRight, DollarSign, AlertTriangle } from "lucide-react";
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

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list("-created_date", 500),
      base44.entities.Movement.list("-created_date", 50),
    ]).then(([prods, movs]) => {
      setProducts(prods);
      setMovements(movs);
      setLoading(false);
    });
  }, []);

  const activeProducts = products.filter((p) => p.status === "active");
  const totalStock = activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValue = activeProducts.reduce((sum, p) => sum + (p.stock || 0) * (p.purchase_price || 0), 0);
  const lowStockProducts = activeProducts.filter((p) => p.stock <= (p.min_stock || 5));
  const todayMovements = movements.filter(
    (m) => new Date(m.created_date).toDateString() === new Date().toDateString()
  );

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
        />
        <StatCard
          title="Valor Total"
          value={`$${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
          subtitle="Al costo de compra"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Movimientos Hoy"
          value={todayMovements.length}
          subtitle="Entradas y salidas"
          icon={ArrowLeftRight}
          color="cyan"
        />
        <StatCard
          title="Stock Bajo"
          value={lowStockProducts.length}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          color={lowStockProducts.length > 0 ? "amber" : "emerald"}
        />
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