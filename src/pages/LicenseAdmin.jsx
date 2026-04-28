import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useLicense } from "@/lib/LicenseContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Users, RefreshCw, Edit, CheckCircle, Clock, Lock, AlertTriangle, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

const STATUS_CONFIG = {
  trial:     { label: "Prueba",       color: "bg-blue-100 text-blue-700",    icon: Clock },
  active:    { label: "Activo",       color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  view_only: { label: "Solo Lectura", color: "bg-amber-100 text-amber-700",  icon: Lock },
  suspended: { label: "Suspendido",   color: "bg-rose-100 text-rose-700",    icon: AlertTriangle },
};

const PLAN_CONFIG = {
  start:  { label: "Start",  limit: 4 },
  growth: { label: "Growth", limit: 10 },
  pro:    { label: "Pro",    limit: 20 },
};

export default function LicenseAdmin() {
  const { isPlatformAdmin, loading: licenseLoading } = useLicense();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [sendingTestEmails, setSendingTestEmails] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(null);

  const load = async () => {
    setLoading(true);
    const r = await base44.functions.invoke("adminGetAllLicenses", {});
    setBusinesses(r.data.businesses || []);
    setLoading(false);
  };

  useEffect(() => { if (!licenseLoading && isPlatformAdmin) load(); }, [isPlatformAdmin, licenseLoading]);

  const filtered = useMemo(() => {
    if (!search) return businesses;
    return businesses.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));
  }, [businesses, search]);

  const handleSendTestEmails = async () => {
    setSendingTestEmails(true);
    try {
      const r = await base44.functions.invoke("sendTestLifecycleEmails", {});
      const { sent, failed, recipient, error, results } = r.data || {};
      if (error) {
        toast.error(`Error en la función: ${error}`);
        console.error("[sendTestLifecycleEmails] error:", error);
      } else if (failed > 0) {
        const firstErr = results?.find(x => x.status === "failed")?.error || "";
        toast.warning(`${sent} enviados, ${failed} fallaron — ${firstErr}`);
        console.warn("[sendTestLifecycleEmails] results:", results);
      } else {
        toast.success(`${sent} correos de prueba enviados a ${recipient}`);
      }
    } catch (err) {
      toast.error(`Error al enviar correos de prueba: ${err?.message || err}`);
      console.error("[sendTestLifecycleEmails] exception:", err);
    } finally {
      setSendingTestEmails(false);
    }
  };

  const handleConfirmPayment = async (biz) => {
    if (!window.confirm(`Confirmar que recibiste el pago de MP para ${biz.name}? Se enviará correo de pago recibido a los admins.`)) return;
    setConfirmingPayment(biz.id);
    try {
      const r = await base44.functions.invoke("confirmRenewalPayment", { business_id: biz.id });
      toast.success(`Correo de pago recibido enviado a ${r.data.recipients} admins`);
    } catch (err) {
      toast.error(`Error al confirmar pago: ${err?.message || err}`);
    } finally {
      setConfirmingPayment(null);
    }
  };

  const openEdit = (biz) => {
    setEditForm({
      billing_status: biz.billing_status,
      license_plan: biz.license_plan || "start",
      licensed_user_limit: biz.licensed_user_limit || 4,
      payment_reference: biz.payment_reference || "",
      activation_notes: biz.activation_notes || "",
      auto_renewal: biz.auto_renewal ?? false,
      license_expires_at: biz.license_expires_at ? biz.license_expires_at.slice(0, 10) : "",
    });
    setEditTarget(biz);
  };

  const [saveWarning, setSaveWarning] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveWarning(null);
    const updates = { ...editForm };
    if (updates.license_expires_at) {
      updates.license_expires_at = new Date(updates.license_expires_at).toISOString();
    } else {
      delete updates.license_expires_at;
    }
    try {
      const r = await base44.functions.invoke("adminUpdateTenantLicense", {
        business_id: editTarget.id,
        updates,
      });
      const data = r?.data || {};
      if (!data.success) {
        if (Array.isArray(data.mismatches) && data.mismatches.length > 0) {
          const fields = data.mismatches.map(m => m.field).join(", ");
          toast.error(`El servidor no guardó estos campos: ${fields}`);
        } else {
          toast.error(data.error || "Error al guardar la licencia");
        }
        console.error("[adminUpdateTenantLicense] failure", data);
        return;
      }
      if (data.warning) {
        toast.warning(data.warning);
        setSaveWarning({ message: data.warning, mismatches: data.mismatches || [] });
        setEditForm(f => ({ ...f, auto_renewal: data.persisted?.auto_renewal ?? f.auto_renewal }));
        load();
        return;
      }
      if (data.persisted && "auto_renewal" in updates && data.persisted.auto_renewal !== updates.auto_renewal) {
        const msg = "auto_renewal no persistió a pesar del reintento";
        toast.warning(msg);
        setSaveWarning({ message: msg, mismatches: [{ field: "auto_renewal", requested: updates.auto_renewal, persisted: data.persisted.auto_renewal }] });
        setEditForm(f => ({ ...f, auto_renewal: data.persisted.auto_renewal }));
        load();
        return;
      }
      toast.success(`Licencia de "${editTarget.name}" actualizada`);
      setEditTarget(null);
      setEditForm({});
      load();
    } catch (err) {
      toast.error(`Error al guardar: ${err?.message || err}`);
      console.error("[adminUpdateTenantLicense] exception", err);
    } finally {
      setSaving(false);
    }
  };

  if (licenseLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  if (!isPlatformAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <Shield className="h-12 w-12 text-rose-300" />
      <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
      <p className="text-slate-500 text-sm text-center">Esta sección es exclusiva para administradores de la plataforma StockFlow.<br />Los administradores de negocio no tienen acceso a este panel.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-500" /> Panel de Licencias
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión interna de licencias por tenant — solo administradores de plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSendTestEmails} disabled={sendingTestEmails}>
            <Mail className={`h-4 w-4 mr-1 ${sendingTestEmails ? "animate-pulse" : ""}`} />
            {sendingTestEmails ? "Enviando..." : "Correos de prueba"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = businesses.filter(b => b.billing_status === status).length;
          const Icon = cfg.icon;
          return (
            <Card key={status} className="border-0 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
            </Card>
          );
        })}
      </div>

      {/* Search + table */}
      <div className="space-y-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar negocio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Negocio</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Usuarios</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trial / Activación</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Auto-Renewal</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ref. Pago</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Sin resultados</td></tr>
                ) : (
                  filtered.map(biz => {
                    const sCfg = STATUS_CONFIG[biz.billing_status] || STATUS_CONFIG.active;
                    const Icon = sCfg.icon;
                    return (
                      <tr key={biz.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{biz.name}</p>
                          <p className="text-xs text-muted-foreground">{moment(biz.created_date).format("DD/MM/YYYY")}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${sCfg.color} border-0 text-xs flex items-center gap-1 w-fit`}>
                            <Icon className="h-3 w-3" /> {sCfg.label}
                          </Badge>
                          {biz.trial_days_left !== null && biz.billing_status === "trial" && (
                            <p className="text-xs text-muted-foreground mt-0.5">{biz.trial_days_left}d restantes</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{PLAN_CONFIG[biz.license_plan]?.label || biz.license_plan}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className={biz.active_user_count >= biz.licensed_user_limit ? "text-rose-600 font-semibold" : ""}>
                              {biz.active_user_count}/{biz.licensed_user_limit}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {biz.trial_end_at && (
                            <p>Trial: {moment(biz.trial_end_at).format("DD/MM/YY")}</p>
                          )}
                          {biz.license_activated_at && (
                            <p>Activada: {moment(biz.license_activated_at).format("DD/MM/YY")}</p>
                          )}
                          {biz.activated_by_admin && (
                            <p className="truncate max-w-[120px]">Por: {biz.activated_by_admin}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {biz.auto_renewal ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs flex items-center gap-1 w-fit">
                              <RotateCcw className="h-3 w-3" /> Auto
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Manual</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">
                          {biz.payment_reference || "—"}
                        </td>
                        <td className="px-4 py-3 flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(biz)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {biz.billing_status === "active" && biz.auto_renewal && (
                            <Button variant="ghost" size="sm" title="Confirmar pago recibido" disabled={confirmingPayment === biz.id} onClick={() => handleConfirmPayment(biz)}>
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) { setEditTarget(null); setEditForm({}); setSaveWarning(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Licencia — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          {saveWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium">{saveWarning.message}</p>
                {saveWarning.mismatches.map(m => (
                  <p key={m.field} className="text-xs mt-0.5">
                    {m.field}: solicitado <strong>{String(m.requested)}</strong>, persistido <strong>{String(m.persisted)}</strong>
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4 pt-2">
            <div>
              <Label>Estado de Facturación</Label>
              <Select value={editForm.billing_status || ""} onValueChange={v => setEditForm(f => ({ ...f, billing_status: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Prueba (trial)</SelectItem>
                  <SelectItem value="active">Activo (licencia activa)</SelectItem>
                  <SelectItem value="view_only">Solo lectura (trial expirado)</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select
                value={editForm.license_plan || "start"}
                onValueChange={v => {
                  const limits = { start: 4, growth: 10, pro: 20 };
                  setEditForm(f => ({ ...f, license_plan: v, licensed_user_limit: limits[v] || 4 }));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Start — 4 usuarios</SelectItem>
                  <SelectItem value="growth">Growth — 10 usuarios</SelectItem>
                  <SelectItem value="pro">Pro — 20 usuarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Límite de usuarios</Label>
              <Input
                type="number"
                min="1"
                value={editForm.licensed_user_limit || 4}
                onChange={e => setEditForm(f => ({ ...f, licensed_user_limit: parseInt(e.target.value) || 4 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Referencia de pago</Label>
              <Input
                placeholder="Folio, transferencia, etc."
                value={editForm.payment_reference || ""}
                onChange={e => setEditForm(f => ({ ...f, payment_reference: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notas de activación</Label>
              <Input
                placeholder="Notas internas..."
                value={editForm.activation_notes || ""}
                onChange={e => setEditForm(f => ({ ...f, activation_notes: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <input
                type="checkbox"
                id="auto_renewal"
                checked={editForm.auto_renewal || false}
                onChange={e => setEditForm(f => ({ ...f, auto_renewal: e.target.checked }))}
                className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              />
              <div>
                <Label htmlFor="auto_renewal" className="cursor-pointer font-medium">Renovación automática</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editForm.auto_renewal
                    ? "Se enviará aviso FYI antes de renovar. Sin recordatorios de pago."
                    : "Se enviarán recordatorios de pago antes de vencer."}
                </p>
              </div>
            </div>
            <div>
              <Label>Fecha de vencimiento / renovación</Label>
              <Input
                type="date"
                value={editForm.license_expires_at || ""}
                onChange={e => setEditForm(f => ({ ...f, license_expires_at: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editForm.auto_renewal
                  ? "Se extiende 1 mes automáticamente cada día 1. Los correos FYI se envían 7 días antes."
                  : "Los correos de recordatorio se enviarán 7, 3 y 1 día(s) antes de esta fecha."}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setEditTarget(null); setEditForm({}); }} disabled={saving}>Cancelar</Button>
              <Button variant="outline" onClick={() => { load(); setEditTarget(null); setEditForm({}); setSaveWarning(null); }} disabled={saving}>Cerrar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}