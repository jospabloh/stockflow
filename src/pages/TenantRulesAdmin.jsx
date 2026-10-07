import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLicense } from "@/lib/LicenseContext";
import TenantRuleCards from "@/components/rules/TenantRuleCards";
import { Shield } from "lucide-react";
import { toast } from "sonner";

const LAST_BUSINESS_KEY = "tenantRules.lastBusiness";

export default function TenantRulesAdmin() {
  const { isPlatformAdmin, loading: licenseLoading } = useLicense();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [savingKey, setSavingKey] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rulesResp, licensesResp] = await Promise.all([
        base44.functions.invoke('tenantRules', { action: 'adminListTenantRules' }),
        base44.functions.invoke('licenses', { action: 'adminGetAllLicenses' }),
      ]);
      const bizList = licensesResp.data?.businesses || [];
      setRules(rulesResp.data?.rules || []);
      setBusinesses(bizList);
      setBusinessId((current) => {
        if (current && bizList.some((b) => b.id === current)) return current;
        let remembered = "";
        try { remembered = localStorage.getItem(LAST_BUSINESS_KEY) || ""; } catch { /* storage unavailable */ }
        return bizList.some((b) => b.id === remembered) ? remembered : (bizList[0]?.id || "");
      });
    } catch (error) {
      toast.error(`Error al cargar reglas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!licenseLoading && isPlatformAdmin) load();
  }, [licenseLoading, isPlatformAdmin]);

  const selectBusiness = (id) => {
    setBusinessId(id);
    try { localStorage.setItem(LAST_BUSINESS_KEY, id); } catch { /* storage unavailable */ }
  };

  const ruleFor = (key, bizId = businessId) =>
    rules.find((r) => r.business_id === bizId && r.rule_key === key);

  // Business names aren't unique; a repeated name gets the end of its id so the
  // wrong tenant can't be picked by mistake.
  const businessLabel = useMemo(() => {
    const seen = {};
    for (const b of businesses) seen[b.name] = (seen[b.name] || 0) + 1;
    return (b) => (seen[b.name] > 1 ? `${b.name} · …${String(b.id).slice(-6)}` : b.name);
  }, [businesses]);

  const activeCount = useMemo(() => {
    const counts = {};
    for (const r of rules) if (r.enabled) counts[r.rule_key] = (counts[r.rule_key] || 0) + 1;
    return counts;
  }, [rules]);

  const toggle = async (entry, enabled) => {
    const existing = ruleFor(entry.key);
    setSavingKey(entry.key);
    try {
      const response = await base44.functions.invoke('tenantRules', {
        action: 'adminUpsertTenantRule',
        business_id: businessId,
        rule_key: entry.key,
        enabled,
        // Keep whatever config/notes the rule already had; the upsert overwrites both.
        config_json: existing?.config_json || entry.defaultConfig || {},
        notes: existing?.notes || "",
      });
      if (!response.data?.success) {
        toast.error(response.data?.error || "No se pudo cambiar la regla");
        return;
      }
      toast.success(enabled ? `Activada: ${entry.title}` : `Desactivada: ${entry.title}`);
      await load();
    } catch (error) {
      toast.error(`No se pudo cambiar la regla: ${error.message}`);
    } finally {
      setSavingKey(null);
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="h-6 w-6 text-brand-500" /> Reglas por negocio</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Comportamientos que se activan solo para un negocio. El cambio aplica al instante.</p>
      </div>

      <div>
        <label htmlFor="rules-business" className="text-sm font-medium text-foreground">Negocio</label>
        <select
          id="rules-business"
          className="mt-1 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={businessId}
          onChange={(e) => selectBusiness(e.target.value)}
          disabled={loading || businesses.length === 0}
        >
          {businesses.length === 0 && <option value="">{loading ? "Cargando..." : "Sin negocios"}</option>}
          {businesses.map((b) => <option key={b.id} value={b.id}>{businessLabel(b)}</option>)}
        </select>
      </div>

      <TenantRuleCards
        isEnabled={(key) => ruleFor(key)?.enabled === true}
        onToggle={toggle}
        busyKey={savingKey}
        disabled={loading || !businessId}
        footer={(entry) => `Activa en ${activeCount[entry.key] || 0} de ${businesses.length} negocios`}
      />
    </div>
  );
}
