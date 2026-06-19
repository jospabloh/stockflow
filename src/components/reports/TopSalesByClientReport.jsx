import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Receipt, Trophy } from "lucide-react";
import { MobileSelect } from "@/components/ui/MobileSelect";
import ExportMenu from "@/components/common/ExportMenu";
import moment from "moment";

// Métodos de pago placeholder que no representan una forma de pago confirmada
const PLACEHOLDER_METHODS = ["Pendiente de confirmar", "Por definir", "Sin cargo", ""];

const TOP_CLIENT_COLUMNS = [
  { key: "posicion", label: "Posición", type: "number" },
  { key: "cliente", label: "Cliente", type: "text" },
  { key: "ventas", label: "Ventas", type: "number" },
  { key: "total_vendido", label: "Total Vendido", type: "currency" },
  { key: "ticket_promedio", label: "Ticket Promedio", type: "currency" },
  { key: "cobrado", label: "Cobrado", type: "currency" },
  { key: "pct_del_total", label: "% del Total", type: "text" },
  { key: "ultima_compra", label: "Última Compra", type: "text" },
];

export default function TopSalesByClientReport({
  quotations = [],
  movements = [],
  dateFrom,
  dateTo,
}) {
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all"); // all | quotation | direct
  const [paidFilter, setPaidFilter] = useState("all"); // all | paid | pending
  const [topN, setTopN] = useState("10");

  // Construye una lista unificada de ventas (cotizaciones concretadas + ventas directas)
  const allSales = useMemo(() => {
    const sales = [];

    quotations.forEach((q) => {
      if (q.status !== "converted") return;
      if ((q.total || 0) <= 0 || q.payment_method === "Sin cargo") return; // excluir traspasos internos / sin cargo
      sales.push({
        client: q.client_name || "Sin cliente",
        date: q.created_date,
        total: q.total || 0,
        payment_method: q.payment_method || "—",
        paid: !!q.paid && q.payment_method && !PLACEHOLDER_METHODS.includes(q.payment_method),
        source: "quotation",
      });
    });

    movements
      .filter((m) => m.type === "exit" && !m.quotation_id)
      .forEach((m) => {
        if ((m.total || 0) <= 0) return;
        sales.push({
          client: m.reason || "Sin cliente",
          date: m.created_date,
          total: m.total || 0,
          payment_method: m.reference || "—",
          paid: !!m.paid,
          source: "direct",
        });
      });

    return sales;
  }, [quotations, movements]);

  // Opciones de filtros derivadas de las ventas existentes
  const uniqueClients = useMemo(
    () => [...new Set(allSales.map((s) => s.client).filter(Boolean))].sort(),
    [allSales]
  );
  const uniquePaymentMethods = useMemo(
    () => [...new Set(allSales.map((s) => s.payment_method).filter((p) => p && p !== "—"))].sort(),
    [allSales]
  );

  // Aplica todos los filtros y agrupa por cliente
  const { ranking, totals } = useMemo(() => {
    const from = moment(dateFrom);
    const to = moment(dateTo).endOf("day");

    const filtered = allSales.filter((s) => {
      const date = moment(s.date);
      const inRange = date.isSameOrAfter(from) && date.isSameOrBefore(to);
      const paymentMatch = paymentFilter === "all" || s.payment_method === paymentFilter;
      const clientMatch = clientFilter === "all" || s.client === clientFilter;
      const sourceMatch = sourceFilter === "all" || s.source === sourceFilter;
      const paidMatch =
        paidFilter === "all" ||
        (paidFilter === "paid" && s.paid) ||
        (paidFilter === "pending" && !s.paid);
      return inRange && paymentMatch && clientMatch && sourceMatch && paidMatch;
    });

    const grouped = {};
    filtered.forEach((s) => {
      if (!grouped[s.client]) {
        grouped[s.client] = {
          client: s.client,
          total: 0,
          paidAmount: 0,
          count: 0,
          lastPurchase: null,
        };
      }
      const g = grouped[s.client];
      g.total += s.total;
      if (s.paid) g.paidAmount += s.total;
      g.count += 1;
      const d = moment(s.date);
      if (!g.lastPurchase || d.isAfter(g.lastPurchase)) g.lastPurchase = d;
    });

    const grandTotal = filtered.reduce((sum, s) => sum + s.total, 0);

    const fullRanking = Object.values(grouped)
      .map((g) => ({
        ...g,
        avgTicket: g.count > 0 ? g.total / g.count : 0,
        pctOfTotal: grandTotal > 0 ? (g.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const limit = topN === "all" ? fullRanking.length : parseInt(topN, 10);

    return {
      ranking: fullRanking.slice(0, limit),
      totals: {
        grandTotal,
        clientCount: fullRanking.length,
        salesCount: filtered.length,
        avgPerClient: fullRanking.length > 0 ? grandTotal / fullRanking.length : 0,
      },
    };
  }, [allSales, dateFrom, dateTo, paymentFilter, clientFilter, sourceFilter, paidFilter, topN]);

  const fmt = (n) => `$${(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

  const resetFilters = () => {
    setPaymentFilter("all");
    setClientFilter("all");
    setSourceFilter("all");
    setPaidFilter("all");
    setTopN("10");
  };

  const maxTotal = ranking.length > 0 ? ranking[0].total : 0;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-0 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px]">
            <label className="text-xs text-slate-500 mb-1 block">Cliente</label>
            <MobileSelect
              value={clientFilter}
              onValueChange={setClientFilter}
              options={[{ value: "all", label: "Todos" }, ...uniqueClients.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-slate-500 mb-1 block">Forma de pago</label>
            <MobileSelect
              value={paymentFilter}
              onValueChange={setPaymentFilter}
              options={[{ value: "all", label: "Todas" }, ...uniquePaymentMethods.map((p) => ({ value: p, label: p }))]}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-slate-500 mb-1 block">Origen</label>
            <MobileSelect
              value={sourceFilter}
              onValueChange={setSourceFilter}
              options={[
                { value: "all", label: "Todas las ventas" },
                { value: "quotation", label: "Por cotización" },
                { value: "direct", label: "Ventas directas" },
              ]}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-slate-500 mb-1 block">Pago</label>
            <MobileSelect
              value={paidFilter}
              onValueChange={setPaidFilter}
              options={[
                { value: "all", label: "Todos" },
                { value: "paid", label: "Cobradas" },
                { value: "pending", label: "Pendientes" },
              ]}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-slate-500 mb-1 block">Mostrar</label>
            <MobileSelect
              value={topN}
              onValueChange={setTopN}
              options={[
                { value: "5", label: "Top 5" },
                { value: "10", label: "Top 10" },
                { value: "20", label: "Top 20" },
                { value: "50", label: "Top 50" },
                { value: "all", label: "Todos" },
              ]}
            />
          </div>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Limpiar
          </Button>
        </div>
      </Card>

      {/* Tarjetas resumen (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Vendido</p>
              <p className="text-lg font-bold text-slate-800">{fmt(totals.grandTotal)}</p>
              <p className="text-xs text-slate-400">{totals.salesCount} ventas</p>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Clientes</p>
              <p className="text-lg font-bold text-emerald-700">{totals.clientCount}</p>
              <p className="text-xs text-slate-400">con compras en el período</p>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-50 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-accent-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Promedio por Cliente</p>
              <p className="text-lg font-bold text-accent-700">{fmt(totals.avgPerClient)}</p>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Mejor Cliente</p>
              <p className="text-sm font-bold text-amber-700 truncate max-w-[160px]">
                {ranking.length > 0 ? ranking[0].client : "—"}
              </p>
              <p className="text-xs text-slate-400">{ranking.length > 0 ? fmt(ranking[0].total) : ""}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabla ranking */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-brand-50/50">
          <div>
            <h3 className="font-semibold text-slate-700">Top de Ventas por Cliente</h3>
            <p className="text-xs text-slate-400 mt-0.5">Ranking de clientes por monto total vendido en el período</p>
          </div>
          <ExportMenu
            columns={TOP_CLIENT_COLUMNS}
            rows={ranking.map((r, idx) => ({
              posicion: idx + 1,
              cliente: r.client,
              ventas: r.count,
              total_vendido: r.total,
              ticket_promedio: r.avgTicket,
              cobrado: r.paidAmount,
              pct_del_total: r.pctOfTotal.toFixed(1) + "%",
              ultima_compra: r.lastPurchase ? r.lastPurchase.format("DD/MM/YYYY") : "—",
            }))}
            filename="top_ventas_cliente"
            title="Top de Ventas por Cliente"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">#</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Ventas</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Total Vendido</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Ticket Prom.</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Cobrado</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium w-[180px]">% del Total</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Última Compra</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Sin ventas en el período seleccionado
                  </td>
                </tr>
              ) : (
                ranking.map((r, idx) => (
                  <tr key={r.client} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                          idx === 0
                            ? "bg-amber-100 text-amber-700"
                            : idx === 1
                            ? "bg-slate-200 text-slate-700"
                            : idx === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.client}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{fmt(r.total)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(r.avgTicket)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{fmt(r.paidAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden min-w-[60px]">
                          <div
                            className="bg-gradient-to-r from-brand-500 to-accent-500 h-full rounded-full"
                            style={{ width: `${maxTotal > 0 ? (r.total / maxTotal) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{r.pctOfTotal.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.lastPurchase ? r.lastPurchase.format("DD/MM/YY") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t text-xs text-slate-500">
          <p>💡 Combina ventas por cotización concretadas y ventas directas. Excluye traspasos internos y ventas sin cargo.</p>
        </div>
      </Card>
    </div>
  );
}
