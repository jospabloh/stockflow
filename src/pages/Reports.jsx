import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, TrendingUp, TrendingDown, Package, DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import moment from "moment";

const COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Reports() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list("-created_date", 500),
      base44.entities.Movement.list("-created_date", 1000),
      base44.entities.Category.list(),
    ]).then(([prods, movs, cats]) => {
      setProducts(prods);
      setMovements(movs);
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  const filteredMovements = movements.filter((m) => {
    const date = moment(m.created_date);
    return date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
  });

  // Top selling products
  const topSelling = (() => {
    const sales = {};
    filteredMovements.filter((m) => m.type === "exit").forEach((m) => {
      sales[m.product_name] = (sales[m.product_name] || 0) + m.quantity;
    });
    return Object.entries(sales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, qty]) => ({ name: name?.length > 20 ? name.slice(0, 20) + "…" : name, cantidad: qty }));
  })();

  // Best margin products
  const bestMargin = products
    .filter((p) => p.purchase_price > 0 && p.sale_price > 0)
    .map((p) => ({
      name: p.name?.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
      margen: Math.round(((p.sale_price - p.purchase_price) / p.purchase_price) * 100),
    }))
    .sort((a, b) => b.margen - a.margen)
    .slice(0, 10);

  // Low rotation products (least exits)
  const lowRotation = (() => {
    const exits = {};
    filteredMovements.filter((m) => m.type === "exit").forEach((m) => {
      exits[m.product_id] = (exits[m.product_id] || 0) + m.quantity;
    });
    return products
      .filter((p) => p.status === "active")
      .map((p) => ({
        name: p.name?.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
        salidas: exits[p.id] || 0,
        stock: p.stock,
      }))
      .sort((a, b) => a.salidas - b.salidas)
      .slice(0, 10);
  })();

  // Stock by category
  const stockByCategory = (() => {
    const catMap = {};
    products.filter((p) => p.status === "active").forEach((p) => {
      const catName = categories.find((c) => c.id === p.category)?.name || "Sin categoría";
      catMap[catName] = (catMap[catName] || 0) + ((p.stock || 0) * (p.purchase_price || 0));
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }));
  })();

  // Daily movements trend
  const dailyTrend = (() => {
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
  })();

  const totalSalesValue = filteredMovements
    .filter((m) => m.type === "exit")
    .reduce((sum, m) => sum + (m.total || 0), 0);
  const totalPurchaseValue = filteredMovements
    .filter((m) => m.type === "entry")
    .reduce((sum, m) => sum + (m.total || 0), 0);

  const handleExportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((r) => Object.values(r).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Date filter */}
      <Card className="border-0 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <Label className="text-xs text-slate-500">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-slate-500">Ventas:</span>
              <span className="font-bold text-emerald-700">${totalSalesValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-500" />
              <span className="text-slate-500">Compras:</span>
              <span className="font-bold text-blue-700">${totalPurchaseValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="bg-white shadow-sm border">
          <TabsTrigger value="sales">Más Vendidos</TabsTrigger>
          <TabsTrigger value="margin">Mejor Margen</TabsTrigger>
          <TabsTrigger value="low">Baja Rotación</TabsTrigger>
          <TabsTrigger value="trend">Tendencia</TabsTrigger>
          <TabsTrigger value="category">Por Categoría</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Productos Más Vendidos</h3>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(topSelling, "mas_vendidos")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topSelling} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="margin">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Productos con Mejor Margen (%)</h3>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(bestMargin, "mejor_margen")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={bestMargin} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="margen" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="low">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Productos de Baja Rotación</h3>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(lowRotation, "baja_rotacion")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={lowRotation} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="salidas" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                <Bar dataKey="stock" fill="#94a3b8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="trend">
          <Card className="border-0 shadow-sm p-6">
            <h3 className="font-semibold text-slate-700 mb-4">Tendencia de Movimientos</h3>
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

        <TabsContent value="category">
          <Card className="border-0 shadow-sm p-6">
            <h3 className="font-semibold text-slate-700 mb-4">Valor del Stock por Categoría</h3>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stockByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={60}
                    paddingAngle={3}
                  >
                    {stockByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString("es-MX")}`} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 min-w-[200px]">
                {stockByCategory.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-slate-600 flex-1">{cat.name}</span>
                    <span className="text-sm font-semibold text-slate-700">${cat.value.toLocaleString("es-MX")}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}