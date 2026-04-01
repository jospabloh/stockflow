import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, AlertCircle } from "lucide-react";
import { MobileSelect } from "@/components/ui/MobileSelect";
import moment from "moment";

export default function OperationalReports({
  quotations,
  movements,
  dateFrom,
  dateTo,
  onDateChange,
}) {
  const [qStatusFilter, setQStatusFilter] = useState("converted");
  const [qClientFilter, setQClientFilter] = useState("all");
  const [qPaymentFilter, setQPaymentFilter] = useState("all");
  const [qPaidFilter, setQPaidFilter] = useState("all");

  const filteredMovements = movements.filter((m) => {
    const date = moment(m.created_date);
    return date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
  });

  const filteredQuotations = quotations.filter((q) => {
    const date = moment(q.created_date);
    const inRange = date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
    const statusMatch = qStatusFilter === "all" || q.status === qStatusFilter;
    const clientMatch = qClientFilter === "all" || q.client_name === qClientFilter;
    const paymentMatch = qPaymentFilter === "all" || q.payment_method === qPaymentFilter;
    const paidMatch = qPaidFilter === "all" || (qPaidFilter === "paid" && q.paid) || (qPaidFilter === "pending" && !q.paid);
    return inRange && statusMatch && clientMatch && paymentMatch && paidMatch;
  });

  const PLACEHOLDER_METHODS = ["Pendiente de confirmar", "Por definir", ""];
  const isPaidConfirmed = (q) => q.paid && q.payment_method && !PLACEHOLDER_METHODS.includes(q.payment_method);
  const pendingPayment = filteredQuotations.filter((q) => !isPaidConfirmed(q));
  const paidQuotations = filteredQuotations.filter((q) => isPaidConfirmed(q));
  const totalConverted = filteredQuotations.reduce((s, q) => s + (q.total || 0), 0);
  const totalPaid = paidQuotations.reduce((s, q) => s + (q.total || 0), 0);
  const totalPending = pendingPayment.reduce((s, q) => s + (q.total || 0), 0);

  const uniqueClients = [...new Set(quotations.map((q) => q.client_name).filter(Boolean))].sort();
  const uniquePaymentMethods = [...new Set(quotations.map((q) => q.payment_method).filter(Boolean))].sort();

  const handleExportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((r) => Object.values(r).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[160px]">
                <label className="text-xs text-slate-500 mb-1 block">Estado</label>
                <MobileSelect value={qStatusFilter} onValueChange={setQStatusFilter} options={[
                  { value: "all", label: "Todos" },
                  { value: "draft", label: "Borrador" },
                  { value: "sent", label: "Enviada" },
                  { value: "accepted", label: "Aceptada" },
                  { value: "converted", label: "Concretada" },
                  { value: "cancelled", label: "Cancelada" }
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
                  <AlertCircle className="h-5 w-5 text-indigo-600" />
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

            {/* Table: Ventas Directas */}
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
              </div>
          </div>
          );
          }