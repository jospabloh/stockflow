import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useBusinessContext } from "@/components/BusinessContext";
import { useMachinerySales, useInvalidateEntities } from "@/hooks/queries";
import {
  MACHINERY_COMMISSION_RATE,
  machinerySaleFinancials,
  machinerySalesTotals,
} from "@/lib/machinerySales";
import { Spinner, LoadingOverlay } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Cog, Plus, Pencil, Trash2, Search, TrendingUp, Percent } from "lucide-react";

const EMPTY_FORM = {
  sale_date: "",
  client_name: "",
  client_business_name: "",
  machine_type: "",
  cost: "",
  sale_price: "",
  notes: "",
};

const money = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COMMISSION_LABEL = `Comisión ${(MACHINERY_COMMISSION_RATE * 100).toLocaleString("es-MX")}%`;

export default function MachinerySales() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const invalidate = useInvalidateEntities();
  const salesQuery = useMachinerySales(businessId);
  const sales = salesQuery.data ?? [];
  const loading = !businessId || salesQuery.isLoading;
  const refreshing = salesQuery.isFetching && !salesQuery.isLoading;

  // El costo, la utilidad y la comisión son confidenciales: quien no tenga
  // 'financials' captura y consulta la venta sin verlos nunca.
  const canSeeFinancials = can("Venta de Maquinaria", "financials");
  const canCreate = can("Venta de Maquinaria", "create");
  const canEdit = can("Venta de Maquinaria", "edit");
  const canDelete = can("Venta de Maquinaria", "delete");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingSale, setDeletingSale] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const hay = `${s.client_name || ""} ${s.client_business_name || ""} ${s.machine_type || ""} ${s.notes || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sales, search]);

  const totals = useMemo(() => machinerySalesTotals(filtered), [filtered]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sale_date: moment().format("YYYY-MM-DD") });
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      sale_date: s.sale_date || "",
      client_name: s.client_name || "",
      client_business_name: s.client_business_name || "",
      machine_type: s.machine_type || "",
      cost: s.cost === 0 || s.cost ? String(s.cost) : "",
      sale_price: s.sale_price === 0 || s.sale_price ? String(s.sale_price) : "",
      notes: s.notes || "",
    });
    setFieldErrors({});
    setFormOpen(true);
  };

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((p) => ({ ...p, [k]: false }));
  };

  const handleSave = async () => {
    const errors = {};
    if (!form.machine_type.trim()) errors.machine_type = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Indica al menos el tipo de máquina");
      return;
    }

    const payload = {
      sale_date: form.sale_date || "",
      client_name: form.client_name.trim(),
      client_business_name: form.client_business_name.trim(),
      machine_type: form.machine_type.trim(),
      sale_price: form.sale_price === "" ? 0 : Number(form.sale_price),
      notes: form.notes.trim(),
    };
    // Sin permiso 'financials' el costo ni se envía: el backend conserva el
    // almacenado en vez de tomarlo del cuerpo (ver handlers/_fields.ts).
    if (canSeeFinancials) {
      payload.cost = form.cost === "" ? 0 : Number(form.cost);
    }

    setSaving(true);
    try {
      const resp = editing
        ? await base44.functions.invoke("machinerySales", {
            action: "updateMachinerySaleSafe",
            sale_id: editing.id,
            ...payload,
          })
        : await base44.functions.invoke("machinerySales", {
            action: "createMachinerySaleSafe",
            business_id: businessId,
            ...payload,
          });

      if (!resp?.data?.success) {
        toast.error(resp?.data?.error || "No se pudo guardar la venta");
        setSaving(false);
        return;
      }

      toast.success(editing ? "✓ Venta actualizada" : "✓ Venta registrada");
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await invalidate("MachinerySale");
    } catch (err) {
      console.error("Save machinery sale error:", err);
      toast.error(`Error al guardar: ${err.message || "Intenta de nuevo"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSale) return;
    try {
      const resp = await base44.functions.invoke("machinerySales", {
        action: "deleteMachinerySaleSafe",
        sale_id: deletingSale.id,
      });
      if (!resp?.data?.success) {
        toast.error(resp?.data?.error || "No se pudo eliminar la venta");
        return;
      }
      toast.success("Venta eliminada");
      setDeletingSale(null);
      await invalidate("MachinerySale");
    } catch (err) {
      console.error("Delete machinery sale error:", err);
      toast.error("No se pudo eliminar la venta");
    }
  };

  if (!businessId) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <Cog className="h-12 w-12 text-slate-300" />
      <p className="text-slate-500">No se encontró un negocio asociado a tu cuenta.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Spinner size="lg" label="Cargando ventas de maquinaria…" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Cog className="h-6 w-6 text-brand-500" /> Venta de Maquinaria
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de máquinas vendidas. No toca inventario ni caja chica: es un libro aparte.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openNew} className="bg-brand-600 hover:bg-brand-700" {...createButtonProps('add')}>
            <Plus className="h-4 w-4 mr-1" /> Nueva venta
          </Button>
        )}
      </div>

      {/* Totales — sólo para quien puede ver cifras */}
      {canSeeFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm p-5 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm font-medium">Vendido</span>
              <TrendingUp className="h-5 w-5 text-white/70" />
            </div>
            <p className="text-3xl font-bold">{money(totals.salePrice)}</p>
            <p className="text-white/80 text-xs mt-1">
              {totals.count} {totals.count === 1 ? "venta cerrada" : "ventas cerradas"}
              {totals.pending > 0 && ` · ${totals.pending} en trámite`}
            </p>
          </Card>

          <Card className="border-0 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Utilidad</span>
              <Cog className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{money(totals.profit)}</p>
            <p className="text-muted-foreground text-xs mt-1">Venta menos costo</p>
          </Card>

          <Card className="border-0 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">{COMMISSION_LABEL}</span>
              <Percent className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{money(totals.commission)}</p>
            <p className="text-muted-foreground text-xs mt-1">Sobre la utilidad</p>
          </Card>
        </div>
      )}

      {/* Buscador + tabla */}
      <Card className="border-0 shadow-sm relative">
        <LoadingOverlay show={refreshing} />
        <div className="p-4 border-b border-border">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, negocio, tipo de máquina..."
              className="pl-8"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table {...createTableProps('Ventas de maquinaria')}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Nombre del negocio</TableHead>
                <TableHead>Tipo</TableHead>
                {canSeeFinancials && <TableHead className="text-right">Costo</TableHead>}
                <TableHead className="text-right">Venta</TableHead>
                {canSeeFinancials && <TableHead className="text-right">Utilidad</TableHead>}
                {canSeeFinancials && <TableHead className="text-right">{COMMISSION_LABEL}</TableHead>}
                {(canEdit || canDelete) && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                    {search ? "Ninguna venta coincide con la búsqueda." : "Todavía no hay ventas registradas."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s, i) => {
                const { profit, commission, settled } = machinerySaleFinancials(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.sale_date
                        ? moment(s.sale_date).format("DD/MM/YYYY")
                        : <Badge variant="outline" className="text-amber-600 border-amber-300">En trámite</Badge>}
                    </TableCell>
                    <TableCell className="font-medium">{s.client_name || "—"}</TableCell>
                    <TableCell>{s.client_business_name || "—"}</TableCell>
                    <TableCell className="max-w-[240px] whitespace-pre-line">{s.machine_type}</TableCell>
                    {canSeeFinancials && (
                      <TableCell className="text-right whitespace-nowrap">{money(s.cost)}</TableCell>
                    )}
                    <TableCell className="text-right whitespace-nowrap">
                      {settled ? money(s.sale_price) : "—"}
                    </TableCell>
                    {canSeeFinancials && (
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {profit === null ? "—" : money(profit)}
                      </TableCell>
                    )}
                    {canSeeFinancials && (
                      <TableCell className="text-right whitespace-nowrap text-amber-600">
                        {commission === null ? "—" : money(commission)}
                      </TableCell>
                    )}
                    {(canEdit || canDelete) && (
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)} {...createButtonProps('edit')}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => setDeletingSale(s)} {...createButtonProps('delete')}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Alta / edición */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar venta" : "Nueva venta de maquinaria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.sale_date} onChange={(e) => set("sale_date", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Déjala vacía si la venta todavía está en trámite.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Cliente</Label>
                <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Mauricio" />
              </div>
              <div>
                <Label>Nombre del negocio</Label>
                <Input value={form.client_business_name} onChange={(e) => set("client_business_name", e.target.value)} placeholder="Alquimia Café" />
              </div>
            </div>
            <div>
              <Label>Tipo <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.machine_type}
                onChange={(e) => set("machine_type", e.target.value)}
                placeholder="Ruby Negra 1 grupo y molino Tranquilo Tron"
                rows={2}
                className={fieldErrors.machine_type ? "border-red-500" : ""}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {canSeeFinancials && (
                <div>
                  <Label>Costo</Label>
                  <Input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="0.00" />
                </div>
              )}
              <div>
                <Label>Venta</Label>
                <Input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)} placeholder="0.00" />
              </div>
            </div>
            {canSeeFinancials && (() => {
              const preview = machinerySaleFinancials({
                cost: form.cost === "" ? 0 : Number(form.cost),
                sale_price: form.sale_price === "" ? 0 : Number(form.sale_price),
              });
              if (!preview.settled) return null;
              return (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex justify-between">
                  <span className="text-muted-foreground">
                    Utilidad <strong className="text-foreground">{money(preview.profit)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    {COMMISSION_LABEL} <strong className="text-amber-600">{money(preview.commission)}</strong>
                  </span>
                </div>
              );
            })()}
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Baja */}
      <AlertDialog open={!!deletingSale} onOpenChange={(open) => !open && setDeletingSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará el registro de {deletingSale?.machine_type || "la máquina"}
              {deletingSale?.client_name ? ` vendida a ${deletingSale.client_name}` : ""}. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
