import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Wallet, PiggyBank, Shield } from "lucide-react";
import { useBusinessContext } from "@/components/BusinessContext";
import { usePermissions } from "@/lib/PermissionContext";
import { createButtonProps, createTableProps } from "@/lib/a11y";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebrate";
import { seedAndDedupeCatalog } from "@/lib/seedCatalog";
import { DEFAULT_ACCOUNTS } from "@/lib/catalogDefaults";

const EMPTY_FORM = { name: "", affects_petty_cash: false };

export default function FundAccounts() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    if (!businessId) return;
    try {
      const data = await seedAndDedupeCatalog({
        entity: "FundAccount",
        businessId,
        defaults: DEFAULT_ACCOUNTS,
        keyOf: (a) => a.name,
      });
      setAccounts(data);
    } catch (err) {
      console.error("Error loading fund accounts:", err);
      toast.error("No se pudieron cargar las cuentas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ name: a.name, affects_petty_cash: !!a.affects_petty_cash }); setFormOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    try {
      if (editing) {
        await base44.entities.FundAccount.update(editing.id, {
          name: form.name.trim(),
          affects_petty_cash: !!form.affects_petty_cash,
        });
        toast.success("✓ Cuenta actualizada");
      } else {
        await base44.entities.FundAccount.create({
          name: form.name.trim(),
          affects_petty_cash: !!form.affects_petty_cash,
          active: true,
          is_system: false,
          business_id: businessId,
        });
        toast.success("✓ Cuenta creada");
        celebrate();
      }
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.FundAccount.delete(id);
      setAccounts(accounts.filter((a) => a.id !== id));
      toast.success("Cuenta eliminada");
    } catch (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const handleToggle = async (a) => {
    try {
      await base44.entities.FundAccount.update(a.id, { active: !a.active });
      setAccounts(accounts.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  if (!can('CuentasFondo', 'view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Shield className="h-12 w-12 text-rose-300" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
        <p className="text-slate-500 text-sm text-center">No tienes permiso para ver las Cuentas de Fondos.<br />Contacta al administrador para solicitar acceso.</p>
      </div>
    );
  }

  const canCreate = can('CuentasFondo', 'create');
  const canEdit = can('CuentasFondo', 'edit');
  const canDelete = can('CuentasFondo', 'delete');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card className="border-0 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-semibold text-slate-700 text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-500" /> Cuentas
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Fuentes de dinero para el módulo de Utilidad (efectivo, tarjetas, etc.)</p>
          </div>
          {canCreate && (
          <Button
            size="sm"
            className="bg-brand-600 hover:bg-brand-700"
            onClick={openNew}
            {...createButtonProps('add')}
          >
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
          )}
        </div>
        <Table {...createTableProps('fund-accounts-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Caja Chica</TableHead>
              <TableHead className="text-center">Activa</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No hay cuentas. Crea la primera.
                </TableCell>
              </TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>
                  {a.affects_petty_cash ? (
                    <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">
                      <PiggyBank className="h-3 w-3 mr-1" /> Descuenta de caja
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={a.active !== false} onCheckedChange={() => handleToggle(a)} disabled={!canEdit} />
                </TableCell>
                <TableCell className="text-center">
                  {canEdit && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} {...createButtonProps('edit')}>
                    <Pencil className="h-4 w-4 text-slate-400" />
                  </Button>
                  )}
                  {canDelete && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(a.id)} {...createButtonProps('delete')}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                  )}
                  {!canEdit && !canDelete && <span className="text-slate-300 text-xs">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="pb-safe">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Efectivo (Caja Chica), Tarjeta AFIRME..."
              />
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/50">
              <Switch
                id="affects-petty-cash"
                checked={!!form.affects_petty_cash}
                onCheckedChange={(v) => setForm((p) => ({ ...p, affects_petty_cash: v }))}
                className="mt-0.5"
              />
              <label htmlFor="affects-petty-cash" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-800">
                  <PiggyBank className="h-4 w-4" /> Es efectivo de Caja Chica
                </div>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  Los movimientos con esta cuenta descuentan/ingresan automáticamente al saldo de Caja Chica.
                </p>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()} className="bg-brand-600 hover:bg-brand-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
