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
      const bId = u?.business_id;
      setIsAdmin(admin);
      const [prods, movs, cats] = await Promise.all([
        base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
        base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
        base44.entities.Category.filter({ business_id: bId }),
      ]);
      setProducts(prods);
      setMovements(movs);
      setCategories(cats);
      const quots = await base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 500).catch(() => []);
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

  // Top selling products by value
  const topSelling = (() => {
    const sales = {};
    filteredMovements.filter((m) => m.type === "exit").forEach((m) => {
      if (!sales[m.product_id]) {
        sales[m.product_id] = { name: m.product_name, qty: 0, value: 0, units_and_value: 0 };
      }
      sales[m.product_id].qty += m.quantity;
      sales[m.product_id].value += (m.total || 0);
      sales[m.product_id].units_and_value += m.quantity;
    });
    return Object.values(sales)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((p) => ({ 
        name: p.name?.length > 20 ? p.name.slice(0, 20) + "…" : p.name, 
        cantidad: p.qty,
        valor: Math.round(p.value)
      }));
  })();

  // Best margin products - DISABLED: product schema uses retail_sale_price/wholesale_sale_price, not sale_price
  const bestMargin = [];

  // Low rotation products (least exits in period) - improved logic
  const lowRotation = (() => {
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
      .filter((p) => p.status === "active" && exits[p.id] !== undefined) // Only products with exits in period
      .map((p) => ({
        name: p.name?.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
        salidas: exits[p.id] || 0,
        stock: p.stock,
        ultima_salida: lastMovementDate[p.id] ? lastMovementDate[p.id].format("DD/MM/YY") : "—",
      }))
      .sort((a, b) => a.salidas - b.salidas)
      .slice(0, 10);
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

  // Ventas reales = cotizaciones convertidas en el período + salidas directas (sin quotation_id)
  const convertedInRange = quotations.filter((q) => {
    const date = moment(q.created_date);
    return q.status === "converted" &&
      date.isSameOrAfter(dateFrom) &&
      date.isSameOrBefore(moment(dateTo).endOf("day"));
  });
  const directExitsInRange = filteredMovements.filter((m) => m.type === "exit" && !m.quotation_id);
  const totalSalesFromQuotations = convertedInRange.reduce((sum, q) => sum + (q.total || 0), 0);
  const totalSalesFromDirectExits = directExitsInRange.reduce((sum, m) => sum + (m.total || 0), 0);
  const totalSalesValue = totalSalesFromQuotations + totalSalesFromDirectExits;
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
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-500">Total ventas:</span>
                <span className="font-bold text-emerald-700">${totalSalesValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[11px] text-slate-400 ml-6">
                Cot: ${totalSalesFromQuotations.toLocaleString("es-MX", { minimumFractionDigits: 2 })} · Directas: ${totalSalesFromDirectExits.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
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

      <Tabs defaultValue={isAdmin ? "quotations" : "movements"} className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1">
          {/* Todos ven Cotizaciones/Ventas y Movimientos */}
          <TabsTrigger value="quotations">Cotizaciones/Ventas</TabsTrigger>
          <TabsTrigger value="movements">Movimientos de Stock</TabsTrigger>
          
          {/* Solo admin ve los reportes analíticos */}
          {isAdmin && (
            <>
              <TabsTrigger value="sales">Más Vendidos</TabsTrigger>
              <TabsTrigger value="low">Baja Rotación</TabsTrigger>
              <TabsTrigger value="trend">Tendencia</TabsTrigger>
              <TabsTrigger value="inventory">Inventario Actual</TabsTrigger>
              <TabsTrigger value="predict">Predicción de Pedidos</TabsTrigger>
            </>
          )}
        </TabsList>

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

          {/* Table: Ventas por Cotización */}
          <Card className="border-0 shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between p-4 border-b bg-indigo-50/50">
              <div>
                <h3 className="font-semibold text-slate-700">Ventas por Cotización</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ventas concretadas a través del flujo de cotización</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(filteredQuotations.map(q => ({
                folio: q.folio, cliente: q.client_name, fecha: moment(q.created_date).format("DD/MM/YYYY"),
                total: q.total, pagado: q.paid ? "Sí" : "No", forma_pago: q.payment_method || "—",
                entregado: q.delivered ? "Sí" : "No"
              })), "ventas_cotizaciones")}>
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
                    filteredQuotations.map((q) => {
                      const deliveredUnpaid = q.delivered && !isPaidConfirmed(q);
                      return (
                        <tr key={q.id} className={`border-t border-slate-100 hover:bg-slate-50/50 ${deliveredUnpaid ? "bg-red-50/60" : ""}`}>
                          <td className="px-4 py-3 font-mono text-indigo-600">
                            {q.folio}
                            {deliveredUnpaid && <span className="ml-1 text-[10px] font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded">¡COBRAR!</span>}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{q.client_name}</td>
                          <td className="px-4 py-3 text-slate-500">{moment(q.created_date).format("DD/MM/YY")}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${deliveredUnpaid ? "text-red-700" : "text-slate-700"}`}>${q.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-center">
                            {q.delivered ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Entregado</span>
                              : q.in_route ? <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">En ruta</span>
                              : <span className="text-slate-400 text-xs">Pendiente</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isPaidConfirmed(q)
                              ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Pagado</span>
                              : deliveredUnpaid
                                ? <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Entregado sin cobrar</span>
                                : q.paid
                                  ? <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Confirmar forma</span>
                                  : <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Pendiente</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{q.payment_method || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Table: Ventas Directas (movimientos sin cotización) */}
          {(() => {
            const directExits = filteredMovements.filter(m => m.type === "exit" && !m.quotation_id);
            const totalDirect = directExits.reduce((s, m) => s + (m.total || 0), 0);
            return (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-cyan-50/50">
                  <div>
                    <h3 className="font-semibold text-slate-700">Ventas Directas (sin cotización)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Movimientos de salida registrados directamente — Total: <span className="font-semibold text-cyan-700">${totalDirect.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleExportCSV(directExits.map(m => ({
                    producto: m.product_name, fecha: moment(m.created_date).format("DD/MM/YYYY"),
                    cantidad: m.quantity, precio_unitario: m.unit_price, total: m.total,
                    cliente: m.reason || "—", forma_pago: m.reference || "—"
                  })), "ventas_directas")}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">Cantidad</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-medium">Precio Unit.</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Forma de Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directExits.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-10 text-slate-400">Sin ventas directas en el período seleccionado</td></tr>
                      ) : (
                        directExits.map((m) => (
                          <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-800">{m.product_name}</td>
                            <td className="px-4 py-3 text-slate-600">{m.reason || "—"}</td>
                            <td className="px-4 py-3 text-slate-500">{moment(m.created_date).format("DD/MM/YY")}</td>
                            <td className="px-4 py-3 text-center text-slate-700">{m.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-600">${(m.unit_price || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700">${(m.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-slate-600">{m.reference || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="sales">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-700">Productos Más Vendidos (por valor)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Período seleccionado</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV(topSelling, "productos_mas_vendidos")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
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
                      <span className="text-slate-600">${p.valor.toLocaleString("es-MX")} · {p.cantidad} u.</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full rounded-full" 
                        style={{ width: `${(p.valor / topSelling[0].valor) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="low">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-amber-50/50">
              <h3 className="font-semibold text-slate-700">Productos de Baja Rotación</h3>
              <p className="text-xs text-slate-400 mt-0.5">Productos con menor movimiento en el período seleccionado</p>
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
                          <td className="px-4 py-3 text-center font-semibold text-amber-600">{p.salidas}</td>
                          <td className="px-4 py-3 text-center text-slate-700">{p.stock}</td>
                          <td className="px-4 py-3 text-center text-slate-500">{prod?.min_stock || 5}</td>
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

        <TabsContent value="movements">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-cyan-50/50">
              <h3 className="font-semibold text-slate-700">Movimientos de Stock</h3>
              <p className="text-xs text-slate-400 mt-0.5">Historial de entradas, salidas, devoluciones y ajustes</p>
            </div>
            <div className="p-4 mb-4">
              <label className="text-xs text-slate-500 mb-2 block">Tipo de movimiento</label>
              <MobileSelect value={movTypeFilter} onValueChange={setMovTypeFilter} options={[
                { value: "all", label: "Todos" },
                { value: "entry", label: "Entrada (Compra)" },
                { value: "exit", label: "Salida (Venta)" },
                { value: "return", label: "Devolución" },
                { value: "adjustment", label: "Ajuste" }
              ]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Tipo</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Cantidad</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Stock Resultante</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">Sin movimientos en el período seleccionado</td></tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const typeLabel = m.type === "entry" ? "Entrada" : m.type === "exit" ? "Salida" : m.type === "return" ? "Devolución" : "Ajuste";
                      const typeBg = m.type === "entry" ? "bg-emerald-100 text-emerald-700" : m.type === "exit" ? "bg-cyan-100 text-cyan-700" : m.type === "return" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700";
                      return (
                        <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-500 text-xs">{moment(m.created_date).format("DD/MM/YY")}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{m.product_name}</td>
                          <td className="px-4 py-3 text-center"><span className={`text-xs font-medium px-2 py-1 rounded ${typeBg}`}>{typeLabel}</span></td>
                          <td className="px-4 py-3 text-center text-slate-700">{m.quantity}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">${(m.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{m.stock_after || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-emerald-50/50">
              <h3 className="font-semibold text-slate-700">Inventario Actual por Producto</h3>
              <p className="text-xs text-slate-400 mt-0.5">Stock actual, valor al costo, y últimas transacciones</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Categoría</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Stock</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Mín.</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Precio Unit.</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter((p) => p.status === "active").length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">Sin productos activos</td></tr>
                  ) : (
                    products.filter((p) => p.status === "active").map((p) => {
                      const catName = categories.find((c) => c.id === p.category)?.name || "Sin categoría";
                      const stockValue = (p.stock || 0) * (p.purchase_price || 0);
                      const isLowStock = p.stock <= (p.min_stock || 5);
                      return (
                        <tr key={p.id} className={`border-t border-slate-100 hover:bg-slate-50/50 ${isLowStock ? "bg-amber-50/50" : ""}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">{p.name?.length > 30 ? p.name.slice(0, 30) + "…" : p.name}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{catName}</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-700">{p.stock}</td>
                          <td className="px-4 py-3 text-center text-slate-500">{p.min_stock || 5}</td>
                          <td className="px-4 py-3 text-right text-slate-600">${(p.purchase_price || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">${stockValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="predict">
          {(() => {
            const lastNDays = 60;
            const cutoffDate = moment().subtract(lastNDays, "days");
            const recentMovements = movements.filter(m => moment(m.created_date).isSameOrAfter(cutoffDate) && m.type === "exit");
            const productSalesFreq = {};
            const productTrends = {};
            
            recentMovements.forEach(m => {
              if (!productSalesFreq[m.product_id]) {
                productSalesFreq[m.product_id] = { name: m.product_name, count: 0, avgQty: 0, totalQty: 0, lastSale: moment(m.created_date) };
              }
              productSalesFreq[m.product_id].count += 1;
              productSalesFreq[m.product_id].totalQty += m.quantity;
              const sale = moment(m.created_date);
              if (sale.isAfter(productSalesFreq[m.product_id].lastSale)) {
                productSalesFreq[m.product_id].lastSale = sale;
              }
            });

            Object.keys(productSalesFreq).forEach(pid => {
              const freq = productSalesFreq[pid];
              freq.avgQty = freq.totalQty / freq.count;
              freq.daysWithoutSale = moment().diff(freq.lastSale, "days");
              freq.salesPerWeek = (freq.count / (lastNDays / 7)).toFixed(1);
              const prod = products.find(p => p.id === pid);
              if (prod) {
                freq.currentStock = prod.stock;
                const weeksUntilStockOut = freq.avgQty > 0 ? (prod.stock / (freq.avgQty * (freq.salesPerWeek / 7))).toFixed(1) : 999;
                freq.alert = weeksUntilStockOut < 2 ? "🔴 URGENTE" : weeksUntilStockOut < 4 ? "🟡 PRONTO" : "🟢 OK";
                freq.weeksUntilStockOut = weeksUntilStockOut;
              }
            });

            const predictions = Object.values(productSalesFreq)
              .filter(p => p.alert) // Solo incluir productos con alert asignada
              .sort((a, b) => parseFloat(a.weeksUntilStockOut) - parseFloat(b.weeksUntilStockOut))
              .slice(0, 15);

            return (
              <Card className="border-0 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-700 text-lg mb-2">Predicción Inteligente de Pedidos</h3>
                  <p className="text-xs text-slate-400">Basado en últimos 60 días: frecuencia de ventas, cantidad promedio y stock actual</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                    <p className="text-xs text-red-600 font-semibold">🔴 URGENTE (&lt; 2 sem.)</p>
                    <p className="text-lg font-bold text-red-700">{predictions.filter(p => p.alert === "🔴 URGENTE").length}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                    <p className="text-xs text-amber-600 font-semibold">🟡 PRONTO (2-4 sem.)</p>
                    <p className="text-lg font-bold text-amber-700">{predictions.filter(p => p.alert === "🟡 PRONTO").length}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                    <p className="text-xs text-emerald-600 font-semibold">🟢 OK (&gt; 4 sem.)</p>
                    <p className="text-lg font-bold text-emerald-700">{predictions.filter(p => p.alert === "🟢 OK").length}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Alerta</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Producto</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">Stock Act.</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">Promedio/Venta</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">Ventas/Sem.</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">Semanas Restantes</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Recomendación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-10 text-slate-400">Sin datos de ventas en los últimos 60 días</td></tr>
                      ) : (
                        predictions.map((p) => (
                          <tr key={p.name} className={`border-t border-slate-100 ${p.alert === "🔴 URGENTE" ? "bg-red-50/50" : p.alert === "🟡 PRONTO" ? "bg-amber-50/50" : ""}`}>
                            <td className="px-4 py-3 text-center text-xl font-bold">{p.alert.split(" ")[0]}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                            <td className="px-4 py-3 text-center text-slate-700">{p.currentStock}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{p.avgQty.toFixed(0)} uds.</td>
                            <td className="px-4 py-3 text-center text-slate-600">{p.salesPerWeek}</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-800">{p.weeksUntilStockOut} sem.</td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {p.alert === "🔴 URGENTE" && "Pedir YA - riesgo de agotamiento"}
                              {p.alert === "🟡 PRONTO" && "Preparar solicitud en próximos días"}
                              {p.alert === "🟢 OK" && "Monitorear, sin urgencia"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
                  <p className="font-semibold mb-2">💡 Cómo funciona:</p>
                  <ul className="space-y-1 ml-4 list-disc">
                    <li>Analiza salidas de los últimos 60 días</li>
                    <li>Calcula promedio de unidades por venta</li>
                    <li>Estima semanas hasta agotamiento del stock</li>
                    <li>Usa el color para priorizar reordenaciones</li>
                  </ul>
                </div>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}