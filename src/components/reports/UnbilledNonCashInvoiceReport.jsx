import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, AlertTriangle } from "lucide-react";
import MonthYearPicker, { formatMonthYearEs } from "@/components/ui/month-year-picker";
import moment from "moment";
import { toast } from "sonner";
import { nonCashAmount, proratePreIva, isEligibleForNonCashInvoicing } from "@/lib/nonCashInvoicing";
import { formatMXN } from "@/lib/vatCalculator";

export default function UnbilledNonCashInvoiceReport({ quotations, onQuotationsUpdated, canAssign, quotationsCapped }) {
  const [month, setMonth] = useState(moment().format("YYYY-MM"));
  const [selected, setSelected] = useState(new Set());
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    return quotations
      .filter((q) => isEligibleForNonCashInvoicing(q))
      .filter((q) => moment(q.created_date).format("YYYY-MM") === month)
      .map((q) => {
        const amount = nonCashAmount(q);
        const { preIva, iva } = proratePreIva(q, amount);
        const methods = [...new Set(
          (q.payments || [])
            .filter((p) => !String(p.payment_method || "").toLowerCase().includes("efectivo"))
            .map((p) => p.payment_method)
            .filter(Boolean)
        )];
        return {
          quotation: q,
          amount: Math.round(amount * 100) / 100,
          preIva: Math.round(preIva * 100) / 100,
          iva: Math.round(iva * 100) / 100,
          methods,
        };
      })
      .sort((a, b) => moment(a.quotation.created_date).diff(moment(b.quotation.created_date)));
  }, [quotations, month]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    amount: acc.amount + r.amount,
    preIva: acc.preIva + r.preIva,
    iva: acc.iva + r.iva,
  }), { amount: 0, preIva: 0, iva: 0 }), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.quotation.id));

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.quotation.id)));
  };

  const handleAssign = async () => {
    const value = invoiceNumberInput.trim();
    if (!value) {
      toast.error("Ingresa un número de factura");
      return;
    }
    setSaving(true);
    const targets = rows.filter((r) => selected.has(r.quotation.id));
    try {
      const results = await Promise.allSettled(targets.map((r) =>
        base44.functions.invoke('quotations', {
          action: 'updateQuotationFlagsSafe',
          quotation_id: r.quotation.id,
          updates: { invoice_number: value, invoice_status: "emitida" },
        })
      ));
      const succeeded = results.filter((res) => res.status === "fulfilled" && res.value?.data?.success).length;
      const failedCount = targets.length - succeeded;
      if (failedCount > 0) {
        toast.error(`Factura ${value}: ${succeeded} de ${targets.length} cotizaciones actualizadas, ${failedCount} fallaron`);
      } else {
        toast.success(`Factura ${value} asignada a ${succeeded} cotizaciones`);
      }
      setInvoiceNumberInput("");
      setAssignDialogOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "No se pudo asignar el número de factura");
    } finally {
      setSaving(false);
      setSelected(new Set());
      onQuotationsUpdated?.();
    }
  };

  const columnCount = canAssign ? 8 : 7;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b bg-emerald-50/50">
        <div>
          <h3 className="font-semibold text-slate-700">Facturación Público General — Pagos No-Efectivo</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cotizaciones no facturadas individualmente (No Requerida) con pagos en un método distinto a efectivo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500">Mes</Label>
          <MonthYearPicker value={month} onChange={setMonth} className="w-40" />
        </div>
      </div>

      {quotationsCapped && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Se alcanzó el límite de 500 cotizaciones cargadas — si el negocio tiene más volumen, este reporte puede no incluir todas las cotizaciones del mes.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              {canAssign && (
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={rows.length === 0} />
                </th>
              )}
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Folio</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Métodos</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Monto no-efectivo</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Pre-IVA</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">IVA</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columnCount} className="text-center py-10 text-slate-400">Sin cotizaciones pendientes de facturar para {formatMonthYearEs(moment(month, "YYYY-MM"))}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.quotation.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  {canAssign && (
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(r.quotation.id)} onCheckedChange={() => toggleRow(r.quotation.id)} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs text-brand-600">{r.quotation.folio}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.quotation.client_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{moment(r.quotation.created_date).format("DD/MM/YY")}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.methods.join(", ")}</td>
                  <td className="px-4 py-3 text-right tabular">${formatMXN(r.amount)}</td>
                  <td className="px-4 py-3 text-right tabular">${formatMXN(r.preIva)}</td>
                  <td className="px-4 py-3 text-right tabular">${formatMXN(r.iva)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50/70 font-semibold">
              <tr>
                <td colSpan={canAssign ? 5 : 4} className="px-4 py-3 text-right text-slate-600">Totales</td>
                <td className="px-4 py-3 text-right tabular">${formatMXN(totals.amount)}</td>
                <td className="px-4 py-3 text-right tabular">${formatMXN(totals.preIva)}</td>
                <td className="px-4 py-3 text-right tabular">${formatMXN(totals.iva)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canAssign && (
        <>
          <div className="p-4 bg-slate-50/50 border-t flex items-center justify-between">
            <p className="text-xs text-slate-500">{selected.size} seleccionada(s)</p>
            <Button size="sm" disabled={selected.size === 0} onClick={() => setAssignDialogOpen(true)}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Asignar N° de factura
            </Button>
          </div>

          <AlertDialog open={assignDialogOpen} onOpenChange={(v) => { if (!v && !saving) setAssignDialogOpen(false); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Asignar número de factura</AlertDialogTitle>
                <AlertDialogDescription>
                  Se asignará a {selected.size} cotización(es) seleccionada(s) y su estado de facturación cambiará a "Emitida".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label className="text-xs text-slate-500">Número de factura</Label>
                <Input
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  placeholder="Ej. A-1024"
                  autoFocus
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={saving}
                  onClick={(e) => { e.preventDefault(); handleAssign(); }}
                >
                  {saving ? "Guardando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </Card>
  );
}
