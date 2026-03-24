import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, TrendingUp, TrendingDown, Package, DollarSign, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { MobileSelect } from "@/components/ui/MobileSelect";
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
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dateFrom, setDateFrom] = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  // Quotation filters
  const [qStatusFilter, setQStatusFilter] = useState("converted");
  const [qClientFilter, setQClientFilter] = useState("all");
  const [qPaymentFilter, setQPaymentFilter] = useState("all");
  const [qPaidFilter, setQPaidFilter] = useState("all");
  // Movement filters
  const [movTypeFilter, setMovTypeFilter] = useState("all");

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      setIsAdmin(admin);
      const [prods, movs, cats] = await Promise.all([
        base44.entities.Product.list("-created_date", 500),
        base44.entities.Movement.list("-created_date", 1000),
        base44.entities.Category.list(),
      ]);
      setProducts(prods);
      setMovements(movs);
      setCategories(cats);
      const quots = await base44.entities.Quotation.list("-created_date", 500).catch(() => []);
      setQuotations(quots);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredMovements = movements.filter((m) => {
    const date = moment(m.created_date);
    const inRange = date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    const typeMatch = movTypeFilter === "all" || m.type === movTypeFilter;
    return inRange && typeMatch;
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

  // Quotation data with comprehensive filtering
  const filteredQuotations = quotations.filter((q) => {
    const date = moment(q.created_date);
    const inRange = date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    const statusMatch = qStatusFilter === "all" || q.status === qStatusFilter;
    const clientMatch = qClientFilter === "all" || q.client_name === qClientFilter;
    const paymentMatch = qPaymentFilter === "all" || q.payment_method === qPaymentFilter;
    const paidMatch = qPaidFilter === "all" || (qPaidFilter === "paid" && q.paid) || (qPaidFilter === "pending" && !q.paid);
    return inRange && statusMatch && clientMatch && paymentMatch && paidMatch;
  });
  
  // Filter for converted/sales data
  const convertedQuotations = quotations.filter((q) => q.status === "converted");

  const PLACEHOLDER_METHODS = ["Pendiente de confirmar", "Por definir", ""];
  const isPaidConfirmed = (q) => q.paid && q.payment_method && !PLACEHOLDER_METHODS.includes(q.payment_method);
  const pendingPayment = filteredQuotations.filter((q) => !isPaidConfirmed(q));
  const paidQuotations = filteredQuotations.filter((q) => isPaidConfirmed(q));
  const totalConverted = filteredQuotations.reduce((s, q) => s + (q.total || 0), 0);
  const totalPaid = paidQuotations.reduce((s, q) => s + (q.total || 0), 0);
  const totalPending = pendingPayment.reduce((s, q) => s + (q.total || 0), 0);

  const uniqueClients = [...new Set(quotations.map((q) => q.client_name).filter(Boolean))].sort();
  const uniquePaymentMethods = [...new Set(quotations.map((q) => q.payment_method).filter(Boolean))].sort();
  const movementTypes = ["entry", "exit", "return", "adjustment"];
  const quotationStatuses = ["draft", "sent", "accepted", "converted", "cancelled"];

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
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
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
            {isAdmin && (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-slate-500">Compras:</span>
                <span className="font-bold text-blue-700">${totalPurchaseValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="quotations" className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="quotations">Cotizaciones/Ventas</TabsTrigger>
          <TabsTrigger value="sales">Más Vendidos</TabsTrigger>
          {isAdmin && <TabsTrigger value="margin">Mejor Margen</TabsTrigger>}
          <TabsTrigger value="low">Baja Rotación</TabsTrigger>
          <TabsTrigger value="trend">Tendencia</TabsTrigger>
          {isAdmin && <TabsTrigger value="category">Por Categoría</TabsTrigger>}
        </TabsList>
        {/* BUG-016: Nota para el usuario — las pestañas de margen y valor usan precios de compra (solo visibles para admins) */}

        <TabsContent value="quotations">
          {/* Filters */}
          <Card className="border-0 shadow-sm p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[160px]">
                <label className="text-xs text-slate-500 mb-1 block">Estado</label>
                <MobileSelect value={qStatusFilter} onValueChange={setQStatusFilter} options={[
                  { value: "all", label: "Todos" },
                  ...quotationStatuses.map(s => ({ value: s, label: s === "draft" ? "Borrador" : s === "sent" ? "Enviada" : s === "accepted" ? "Aceptada" : s === "converted" ? "Concretada" : "Cancelada" }))
                ]} />
              </div>
              <div className="min-w-[160px]">
                <label className="text-xs text-slate-500 mb-1 block">Cliente</label>
                <MobileSelect value={qClientFilter} onValueChange={setQClientFilter} options={[{ value: "all", label: "Todos" }, ...uniqueClients.map(c => ({ value: c, label: c }))]} />
              </div>
              <div className="min-w-[160px]">
                <label className="text-xs text-slate-500 mb-1 block">Forma de pago</label>
                <MobileSelect value={qPaymentFilter} onValueChange={setQPaymentFilter} options={[{ value: "all", label: "Todas" }, ...uniquePaymentMethods.map(p => ({ value: p, label: p }))]} />
              </div>
              <div className="min-w-[160px]">
                <label className="text-xs text-slate-500 mb-1 block">Pago</label>
                <MobileSelect value={qPaidFilter} onValueChange={setQPaidFilter} options={[{ value: "all", label: "Todos" }, { value: "paid", label: "Pagadas" }, { value: "pending", label: "Pendientes" }]} />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setQStatusFilter("converted"); setQClientFilter("all"); setQPaymentFilter("all"); setQPaidFilter("all"); }}>
                Limpiar
              </Button>
            </div>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card className="border-0 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Ventas</p>
                  <p className="text-lg font-bold text-slate-800">${totalConverted.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400">{filteredQuotations.length} cotizaciones</p>
                </div>
              </div>
            </Card>
            <Card className="border-0 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cobrado</p>
                  <p className="text-lg font-bold text-emerald-700">${totalPaid.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400">{paidQuotations.length} pagadas</p>
                </div>
              </div>
            </Card>
            <Card className="border-0 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pendiente de Pago</p>
                  <p className="text-lg font-bold text-amber-700">${totalPending.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400">{pendingPayment.length} pendientes</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-700">Detalle de Ventas Concretadas</h3>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(filteredQuotations.map(q => ({
                folio: q.folio, cliente: q.client_name, fecha: moment(q.created_date).format("DD/MM/YYYY"),
                total: q.total, pagado: q.paid ? "Sí" : "No", forma_pago: q.payment_method || "—",
                entregado: q.delivered ? "Sí" : "No"
              })), "ventas")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Folio</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Entrega</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Pago</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Forma de Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">Sin ventas en el período seleccionado</td></tr>
                  ) : (
                    filteredQuotations.map((q) => (
                      <tr key={q.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-indigo-600">{q.folio}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{q.client_name}</td>
                        <td className="px-4 py-3 text-slate-500">{moment(q.created_date).format("DD/MM/YY")}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">${q.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-center">
                          {q.delivered ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Entregado</span>
                            : q.in_route ? <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">En ruta</span>
                            : <span className="text-slate-400 text-xs">Pendiente</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isPaidConfirmed(q)
                            ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Pagado</span>
                            : q.paid
                              ? <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Confirmar forma</span>
                              : <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Pendiente</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{q.payment_method || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

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