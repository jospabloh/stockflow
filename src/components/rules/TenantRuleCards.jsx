import React from "react";
import { TENANT_RULE_CATALOG } from "@/lib/tenantRuleCatalog";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

// One card per rule: what it does, what it affects, one switch.
// Shared by Configuración → Reglas (a business's admin, their own business)
// and Reglas por negocio (platform owner, any business).
export default function TenantRuleCards({ isEnabled, onToggle, busyKey, disabled, footer }) {
  return (
    <div className="space-y-3">
      {TENANT_RULE_CATALOG.map((entry) => {
        const enabled = isEnabled(entry.key);
        const busy = busyKey === entry.key;
        return (
          <Card key={entry.key} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p id={`rule-${entry.key}`} className="font-semibold text-foreground">{entry.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                <p className="text-xs font-medium text-foreground mt-3">Afecta:</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground list-disc pl-4">
                  {entry.affects.map((a) => <li key={a}>{a}</li>)}
                </ul>
                {footer && <p className="text-[11px] text-muted-foreground mt-3">{footer(entry)}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Switch
                  aria-labelledby={`rule-${entry.key}`}
                  checked={enabled}
                  disabled={disabled || busy}
                  onCheckedChange={(v) => onToggle(entry, !!v)}
                />
                <span className={`text-xs font-medium ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {busy ? "Guardando..." : enabled ? "Activa" : "Apagada"}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
