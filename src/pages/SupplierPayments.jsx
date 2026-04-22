import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createButtonProps, createTableProps } from "@/lib/a11y";
import { toast } from "sonner";
import moment from "moment";
import {
  HandCoins,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  Crown,
  PiggyBank,
} from "lucide-react";

const EMPTY_FORM = {
  supplier_id: "",
  amount: "",
  payment_date: moment().format("YYYY-MM-DD"),
  payment_method: "",
  concept: "",
  reference: "",
  notes: "",
  affects_petty_cash: false,
};

const PETTY_CASH_CATEGORY = "Pago a proveedor";

export default function SupplierPayments() {
  const { businessId } = useBusinessContext();
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

  const [deletingPayment, setDeletingPayment] = useState(null);

  // Filtros
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  const loadAll = async () => {
    if (!businessId) return;
    try {
      const [pays, catalogsRes] = await Promise.all([
        base44.entities.SupplierPayment.filter({ business_id: businessId }, "-payment_date", 1000),
        base44.functions.invoke('getBusinessCatalogs', {}),
      ]);
      const catalogs = catalogsRes?.data || {};
      setPayments(pays);
      setSuppliers(catalogs.suppliers || []);
      setPaymentMethods(catalogs.paymentMethods || []);
    } catch (err) {
      console.error("Error loading supplier payments:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [businessId]);

  // ── KPIs del mes actual ─────────────────────────────────────────
  const monthStart = moment().startOf("month").format("YYYY-MM-DD");
  const monthEnd = moment().endOf("month").format("YYYY-MM-DD");
  const { monthTotal, monthCount, topSupplier } = useMemo(() => {
    let total = 0;
    let count = 0;
    const bySupplier = {};
    payments.forEach(p => {
      const d = p.payment_date || "";
      if (d >= monthStart && d <= monthEnd) {
        total += Number(p.amount) || 0;
        count += 1;
        const key = p.supplier_id || "unknown";
        bySupplier[key] = bySupplier[key] || { name: p.supplier_name || "—", total: 0 };
        bySupplier[key].total += Number(p.amount) || 0;
      }
    });
    const top = Object.values(bySupplier).sort((a, b) => b.total - a.total)[0];
    return { monthTotal: total, monthCount: count, topSupplier: top || null };
  }, [payments, monthStart, monthEnd]);

  // ── Filtrado de tabla ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter(p => {
      if (filterSupplier !== "all" && p.supplier_id !== filterSupplier) return false;
      const d = p.payment_date || "";
      if (filterFrom && d < filterFrom) return false;
      if (filterTo && d > filterTo) return false;
      if (q) {
        const hay = `${p.supplier_name || ""} ${p.concept || ""} ${p.reference || ""} ${p.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, filterSupplier, filterFrom, filterTo, search]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      supplier_id: p.supplier_id || "",
      amount: String(p.amount ?? ""),
      payment_date: p.payment_date || moment().format("YYYY-MM-DD"),
      payment_method: p.payment_method || "",
      concept: p.concept || "",
      reference: p.reference || "",
      notes: p.notes || "",
      affects_petty_cash: !!p.affects_petty_cash,
    });
    setFieldErrors({});
    setFormOpen(true);
  };

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (fieldErrors[k]) setFieldErrors(p => ({ ...p, [k]: false }));
  };

  const handleSave = async () => {
    const errors = {};
    const amountNum = parseFloat(form.amount);
    if (!form.supplier_id) errors.supplier_id = true;
    if (!amountNum || amountNum <= 0) errors.amount = true;
    if (!form.payment_date) errors.payment_date = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    const supplier = suppliers.find(s => s.id === form.supplier_id);
    const payload = {
      business_id: businessId,
      supplier_id: form.supplier_id,
      supplier_name: supplier?.name || "",
      amount: amountNum,
      payment_date: form.payment_date,
      payment_method: form.payment_method || "",
      concept: form.concept.trim(),
      reference: form.reference.trim(),
      notes: form.notes.trim(),
      affects_petty_cash: !!form.affects_petty_cash,
    };

    setSaving(true);
    try {
      if (editing) {
        // Sincronizar caja chica
        const prevAffects = !!editing.affects_petty_cash;
        const nextAffects = !!form.affects_petty_cash;
        const existingPcId = editing.petty_cash_movement_id;

        let pettyCashId = existingPcId || null;

        if (nextAffects && existingPcId) {
          await base44.entities.PettyCashMovement.update(existingPcId, {
            amount: amountNum,
            description: payload.concept || `Pago a ${payload.supplier_name}`,
            category: PETTY_CASH_CATEGORY,
            movement_date: payload.payment_date,
            reference: payload.reference,
            notes: payload.notes,
            payment_method_snapshot: payload.payment_method,
          }).catch(err => console.warn("No se pudo actualizar caja chica", err));
        } else if (nextAffects && !existingPcId) {
          const pc = await base44.entities.PettyCashMovement.create({
            business_id: businessId,
            movement_type: "expense",
            amount: amountNum,
            description: payload.concept || `Pago a ${payload.supplier_name}`,
            category: PETTY_CASH_CATEGORY,
            movement_date: payload.payment_date,
            reference: payload.reference,
            notes: payload.notes,
            generated_by_system: true,
            payment_method_snapshot: payload.payment_method,
          });
          pettyCashId = pc?.id || null;
        } else if (!nextAffects && prevAffects && existingPcId) {
          await base44.entities.PettyCashMovement.delete(existingPcId).catch(err => console.warn("No se pudo eliminar egreso caja chica", err));
          pettyCashId = null;
        }

        await base44.entities.SupplierPayment.update(editing.id, {
          ...payload,
          petty_cash_movement_id: pettyCashId || "",
        });
        toast.success("✓ Pago actualizado");
      } else {
        let pettyCashId = "";
        if (payload.affects_petty_cash) {
          const pc = await base44.entities.PettyCashMovement.create({
            business_id: businessId,
            movement_type: "expense",
            amount: amountNum,
            description: payload.concept || `Pago a ${payload.supplier_name}`,
            category: PETTY_CASH_CATEGORY,
            movement_date: payload.payment_date,
            reference: payload.reference,
            notes: payload.notes,
            generated_by_system: true,
            payment_method_snapshot: payload.payment_method,
          });
          pettyCashId = pc?.id || "";
        }
        await base44.entities.SupplierPayment.create({
          ...payload,
          petty_cash_movement_id: pettyCashId,
        });
        toast.success("✓ Pago registrado");
      }
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      console.error("Save payment error:", err);
      toast.error(`Error al guardar: ${err.message || "Intenta de nuevo"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPayment) return;
    try {
      if (deletingPayment.affects_petty_cash && deletingPayment.petty_cash_movement_id) {
        await base44.entities.PettyCashMovement.delete(deletingPayment.petty_cash_movement_id)
          .catch(err => console.warn("No se pudo eliminar egreso caja chica asociado", err));
      }
      await base44.entities.SupplierPayment.delete(deletingPayment.id);
      toast.success("Pago eliminado");
      setDeletingPayment(null);
      await loadAll();
    } catch (err) {
      console.error("Delete payment error:", err);
      toast.error("No se pudo eliminar el pago");
    }
  };

  if (!businessId) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <HandCoins className="h-12 w-12 text-slate-300" />
      <p className="text-slate-500">No se encontró un negocio asociado a tu cuenta.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-indigo-500" /> Pagos a Proveedores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registra los desembolsos a tus proveedores para calcular la utilidad neta del negocio
          </p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700" {...createButtonProps('add')}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Pago
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-100 text-sm font-medium">Total pagado este mes</span>
            <TrendingUp className="h-5 w-5 text-orange-200" />
          </div>
          <p className="text-3xl font-bold">
            ${monthTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-orange-100 text-xs mt-1">{moment().format("MMMM YYYY")}</p>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Pagos registrados</span>
            <HandCoins className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{monthCount}</p>
          <p className="text-muted-foreground text-xs mt-1">En el mes actual</p>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Top proveedor</span>
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          {topSupplier ? (
            <>
              <p className="text-base font-bold text-foreground truncate" title={topSupplier.name}>
                {topSupplier.name}
              </p>
              <p className="text-amber-600 text-sm font-semibold mt-1">
                ${topSupplier.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm mt-2">Sin pagos este mes</p>
          )}
        </Card>
      </div>

      {/* Filtros + tabla */}
      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Proveedor, concepto, referencia..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Proveedor</Label>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {(filterSupplier !== "all" || filterFrom || filterTo || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterSupplier("all"); setFilterFrom(""); setFilterTo(""); setSearch(""); }}
              className="text-slate-500"
            >
              <Filter className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          )}
        </div>

        <Table {...createTableProps('supplier-payments-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden md:table-cell">Concepto</TableHead>
              <TableHead className="hidden sm:table-cell">Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-center w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {moment(p.payment_date).format("DD/MM/YYYY")}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[180px]">{p.supplier_name || "—"}</span>
                    {p.affects_petty_cash && (
                      <Badge variant="outline" className="h-5 text-[10px] border-rose-300 text-rose-600 dark:border-rose-800 dark:text-rose-400">
                        <PiggyBank className="h-3 w-3 mr-0.5" />Caja
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-slate-500 hidden md:table-cell max-w-[240px] truncate" title={p.concept}>
                  {p.concept || "—"}
                </TableCell>
                <TableCell className="text-slate-500 hidden sm:table-cell">{p.payment_method || "—"}</TableCell>
                <TableCell className="text-right font-bold text-orange-700 dark:text-orange-400 whitespace-nowrap">
                  ${Number(p.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} {...createButtonProps('edit')}>
                    <Pencil className="h-4 w-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingPayment(p)} {...createButtonProps('delete')}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-400 py-10">
                  {payments.length === 0
                    ? "No hay pagos registrados. ¡Crea el primero!"
                    : "No hay pagos que coincidan con los filtros"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog formulario */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg flex flex-col max-h-[min(90dvh,720px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editing ? "Editar Pago" : "Nuevo Pago a Proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Proveedor */}
            <div>
              <Label>Proveedor *</Label>
              <div className={fieldErrors.supplier_id ? "rounded-md ring-1 ring-red-500" : ""}>
                <SearchableSelect
                  value={form.supplier_id}
                  onValueChange={v => set("supplier_id", v)}
                  placeholder={suppliers.length === 0 ? "Primero registra proveedores" : "Selecciona un proveedor"}
                  options={suppliers.map(s => ({
                    value: s.id,
                    label: s.contact_name || s.name,
                    searchLabel: s.name,
                  }))}
                />
              </div>
              {fieldErrors.supplier_id && <p className="text-xs text-red-500 mt-1">Selecciona un proveedor</p>}
            </div>

            {/* Monto + Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => set("amount", e.target.value)}
                  className={`text-lg font-semibold ${fieldErrors.amount ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {fieldErrors.amount && <p className="text-xs text-red-500 mt-1">Monto inválido</p>}
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={e => set("payment_date", e.target.value)}
                  className={fieldErrors.payment_date ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <Label>Método de pago</Label>
              <SearchableSelect
                value={form.payment_method || ""}
                onValueChange={v => {
                  set("payment_method", v);
                  if (String(v || "").trim().toLowerCase() !== "efectivo") {
                    set("affects_petty_cash", false);
                  }
                }}
                placeholder="Selecciona un método"
                options={paymentMethods.map(pm => ({ value: pm.name, label: pm.name }))}
              />
              {paymentMethods.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-1">Puedes registrar métodos en Catálogos → Tipo de pago</p>
              )}
            </div>

            {/* Concepto */}
            <div>
              <Label>Concepto</Label>
              <Textarea
                rows={2}
                value={form.concept}
                onChange={e => set("concept", e.target.value)}
                placeholder="Ej. Factura 1234, abono compra agosto…"
              />
            </div>

            {/* Referencia */}
            <div>
              <Label>Referencia / folio</Label>
              <Input
                value={form.reference}
                onChange={e => set("reference", e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {/* Notas */}
            <div>
              <Label>Notas</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {/* Toggle caja chica — solo visible cuando el método de pago es efectivo */}
            {String(form.payment_method || "").trim().toLowerCase() === "efectivo" && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
                <Switch
                  id="affects-petty-cash"
                  checked={!!form.affects_petty_cash}
                  onCheckedChange={v => set("affects_petty_cash", v)}
                  className="mt-0.5"
                />
                <label htmlFor="affects-petty-cash" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose-800 dark:text-rose-300">
                    <PiggyBank className="h-4 w-4" /> Descontar de Caja Chica
                  </div>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-0.5">
                    Crea automáticamente un egreso en Caja Chica por este monto. Podrás verlo pero no editarlo desde ahí; los cambios se hacen desde este pago.
                  </p>
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.supplier_id || !form.amount || !form.payment_date}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={!!deletingPayment} onOpenChange={(v) => !v && setDeletingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el registro del pago de <strong>{deletingPayment?.supplier_name}</strong> por {' '}
              <strong>${Number(deletingPayment?.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>.
              {deletingPayment?.affects_petty_cash && (
                <span className="block mt-2 text-rose-600 dark:text-rose-400">
                  También se eliminará el egreso asociado en Caja Chica.
                </span>
              )}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
