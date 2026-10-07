import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import TenantRuleCards from "@/components/rules/TenantRuleCards";
import { toast } from "sonner";

// Configuración → Reglas: the business's admin switches their own rules.
// The server re-derives business and role from the stored user (setMyTenantRule).
export default function BusinessRulesPanel() {
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('tenantRules', { action: 'getCurrentTenantRuleMap' });
      setRules(res?.data?.rules || {});
    } catch (error) {
      toast.error(`No se pudieron cargar las reglas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (entry, enabled) => {
    setBusyKey(entry.key);
    try {
      const res = await base44.functions.invoke('tenantRules', { action: 'setMyTenantRule', rule_key: entry.key, enabled });
      if (!res?.data?.success) {
        const err = res?.data?.error;
        toast.error(err === 'write_blocked' ? "Tu licencia no permite cambios en este momento" : (err || "No se pudo cambiar la regla"));
        return;
      }
      toast.success(enabled ? `Activada: ${entry.title}` : `Desactivada: ${entry.title}`);
      await load();
    } catch (error) {
      toast.error(`No se pudo cambiar la regla: ${error?.data?.error || error.message}`);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Reglas del negocio</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Actívalas o apágalas según lo necesites. El cambio aplica al instante para todo tu equipo.</p>
      </div>
      <TenantRuleCards
        isEnabled={(key) => rules[key]?.enabled === true}
        onToggle={toggle}
        busyKey={busyKey}
        disabled={loading}
      />
    </div>
  );
}
