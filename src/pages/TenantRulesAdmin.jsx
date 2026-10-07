import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLicense } from "@/lib/LicenseContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Search, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";
import moment from "moment";
import { toast } from "sonner";

const RULE_KEYS = [
  "cash_sales_to_petty_cash",
  "allow_manual_petty_cash_edit_delete",
  "special_delivery_flow",
  "custom_pricing_override",
  "require_catalog_client_for_quotations",
];

const EMPTY_FORM = {
  id: null,
  business_id: "",
  rule_key: RULE_KEYS[0],
  enabled: false,
  config_json: "{}",
  notes: "",
};

export default function TenantRulesAdmin() {
  const { isPlatformAdmin, loading: licenseLoading } = useLicense();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [search, setSearch] = useState("");
  const [ruleKeyFilter, setRuleKeyFilter] = useState("all");
  const [enabledFilter, setEnabledFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [activating, setActivating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const [rulesResp, licensesResp] = await Promise.all([
        base44.functions.invoke('tenantRules', { action: 'adminListTenantRules',
          search,
          rule_key: ruleKeyFilter === "all" ? undefined : ruleKeyFilter,
          enabled: enabledFilter === "all" ? undefined : enabledFilter === "enabled",
        }),
        base44.functions.invoke('licenses', { action: 'adminGetAllLicenses',}),
      ]);

      setRules(rulesResp.data?.rules || []);
      setBusinesses(licensesResp.data?.businesses || []);
    } catch (error) {
      toast.error(`Error al cargar reglas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!licenseLoading && isPlatformAdmin) {
      load();
    }
  }, [licenseLoading, isPlatformAdmin]);

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      const matchesSearch = !search || (r.business_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesRule = ruleKeyFilter === "all" || r.rule_key === ruleKeyFilter;
      const matchesEnabled = enabledFilter === "all" || (enabledFilter === "enabled" ? r.enabled : !r.enabled);
      return matchesSearch && matchesRule && matchesEnabled;
    });
  }, [rules, search, ruleKeyFilter, enabledFilter]);

  const summaryByRule = useMemo(() => {
    return RULE_KEYS.map((key) => {
      const active = rules.filter((r) => r.rule_key === key && r.enabled).length;
      const total = rules.filter((r) => r.rule_key === key).length;
      return { key, active, total };
    });
  }, [rules]);

  const baristopRuleActive = rules.some(
    (r) => r.rule_key === "cash_sales_to_petty_cash" && (r.business_name || "").toLowerCase().includes("baristop")
  );

  const handleActivateBaristop = async () => {
    setActivating(true);
    try {
      const response = await base44.functions.invoke('tenantRules', { action: 'activateBaristopCashRule',});
      if (!response.data?.success) {
        toast.error(response.data?.error || "No se pudo activar la regla");
        return;
      }
      toast.success("Regla Baristop activada correctamente");
      await load();
    } catch (error) {
      toast.error(`Error al activar: ${error.message}`);
    } finally {
      setActivating(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rule) => {
    setForm({
      id: rule.id,
      business_id: rule.business_id,
      rule_key: rule.rule_key,
      enabled: !!rule.enabled,
      config_json: JSON.stringify(rule.config_json || {}, null, 2),
      notes: rule.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(form.config_json || "{}");
      if (Array.isArray(parsedConfig) || parsedConfig === null || typeof parsedConfig !== "object") {
        throw new Error("config_json debe ser un objeto JSON");
      }
    } catch (error) {
      toast.error(`config_json inválido: ${error.message}`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        business_id: form.business_id,
        rule_key: form.rule_key,
        enabled: !!form.enabled,
        config_json: parsedConfig,
        notes: form.notes || "",
      };
      const response = await base44.functions.invoke('tenantRules', { action: 'adminUpsertTenantRule', ...payload });
      if (!response.data?.success) {
        toast.error(response.data?.error || "No se pudo guardar la regla");
        return;
      }
      toast.success("Regla guardada correctamente");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const response = await base44.functions.invoke('tenantRules', { action: 'adminDeleteTenantRule', tenant_rule_id: id });
      if (!response.data?.success) {
        toast.error(response.data?.error || "No se pudo eliminar la regla");
        return;
      }
      toast.success("Regla archivada correctamente");
      await load();
    } catch (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (licenseLoading) {
    return <div className="flex items-center justify-center min-h-64"><div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <Shield className="h-12 w-12 text-rose-300" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
        <p className="text-slate-500 text-sm text-center">Esta sección es exclusiva para administradores de plataforma.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="h-6 w-6 text-brand-500" /> Reglas por Tenant</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Excepciones operativas por negocio administradas a nivel plataforma.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar</Button>
          {!baristopRuleActive && (
            <Button variant="outline" onClick={handleActivateBaristop} disabled={activating || loading}>
              {activating ? "Activando..." : "Activar Baristop"}
            </Button>
          )}
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nueva Regla</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryByRule.map((s) => (
          <Card key={s.key} className="p-4">
            <p className="text-xs text-muted-foreground truncate">{s.key}</p>
            <p className="text-2xl font-bold text-foreground">{s.active}</p>
            <p className="text-xs text-muted-foreground">activa(s) de {s.total}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre de negocio" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" value={ruleKeyFilter} onChange={(e) => setRuleKeyFilter(e.target.value)}>
          <option value="all">Todas las reglas</option>
          {RULE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value)}>
          <option value="all">Todas</option>
          <option value="enabled">Habilitadas</option>
          <option value="disabled">Deshabilitadas</option>
        </select>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold">Negocio</th>
                <th className="text-left px-4 py-3 font-semibold">Rule key</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Notas</th>
                <th className="text-left px-4 py-3 font-semibold">Actualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.business_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.business_id}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.rule_key}</td>
                  <td className="px-4 py-3">{r.enabled ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Habilitada</Badge> : <Badge className="bg-slate-100 text-slate-700 border-0">Deshabilitada</Badge>}</td>
                  <td className="px-4 py-3 max-w-[280px] truncate text-muted-foreground">{r.notes || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{moment(r.updated_date || r.created_date).format("DD/MM/YYYY HH:mm")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar regla" : "Nueva regla"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Negocio</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.business_id} onChange={(e) => setForm((f) => ({ ...f, business_id: e.target.value }))}>
                <option value="">Seleccionar negocio</option>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Rule key</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.rule_key} onChange={(e) => setForm((f) => ({ ...f, rule_key: e.target.value }))}>
                {RULE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="m-0">Habilitada</Label>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: !!v }))} />
            </div>
            <div>
              <Label>config_json (objeto JSON)</Label>
              <Textarea rows={8} className="mt-1 font-mono text-xs" value={form.config_json} onChange={(e) => setForm((f) => ({ ...f, config_json: e.target.value }))} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={3} className="mt-1" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.business_id}>{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
