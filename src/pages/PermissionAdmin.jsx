import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLicense } from "@/lib/LicenseContext";
import { usePermissions } from "@/lib/PermissionContext";
import { useBusinessContext } from "@/components/BusinessContext";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import UnifiedPermissionMatrix from "@/components/permissions/UnifiedPermissionMatrix";
import { PERMISSION_MATRIX } from "@/components/permissions/UnifiedPermissionMatrix";
import { isBusinessAdmin } from "@/lib/roles";



function buildInitialPerms() {
  return {};
}

export default function PermissionAdmin() {
  const { isPlatformAdmin } = useLicense();
  const { reload: reloadPermissions } = usePermissions();
  const { businessId } = useBusinessContext();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profiles, setProfiles] = useState({});
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perms, setPerms] = useState({
    admin: {},
    almacenista: {},
  });
  const [saving, setSaving] = useState(false);
  const [togglingFeature, setTogglingFeature] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoadingUser(false);
    }).catch(() => setLoadingUser(false));
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('permissions', { action: 'getPermissionProfiles',});
      const data = response.data;
      setProfiles(data?.profiles || {});
      setFeatureEnabled(data?.featureEnabled === true);
      // Admin por defecto con todos los permisos activados
      const adminPerms = data?.profiles?.admin;
      if (!adminPerms || Object.keys(adminPerms).length === 0) {
        const allPerms = {};
        Object.entries(PERMISSION_MATRIX).forEach(([module, moduleData]) => {
          moduleData.actions.forEach(action => {
            allPerms[`${module}:${action.id}`] = true;
          });
        });
        setPerms({
          admin: allPerms,
          almacenista: data?.profiles?.almacenista || {},
        });
      } else {
        setPerms({
          admin: adminPerms || {},
          almacenista: data?.profiles?.almacenista || {},
        });
      }
    } catch (error) {
      toast.error(`Error al cargar permisos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const seedProfiles = async () => {
    if (!businessId && !isPlatformAdmin) return;
    try {
      await base44.functions.invoke('permissions', { action: 'seedDefaultPermissionProfiles',});
      setSeeded(true);
    } catch (_) {}
  };

  useEffect(() => {
    if (loadingUser) return;
    if (!isPlatformAdmin && !isBusinessAdmin(user)) return;
    seedProfiles().then(() => loadProfiles());
  }, [loadingUser, isPlatformAdmin, user, businessId]);

  const handleToggleAction = (role, key, value) => {
    setPerms(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: value,
      },
    }));
  };

  const handleSave = async (role) => {
    setSaving(true);
    try {
      const response = await base44.functions.invoke('permissions', { action: 'upsertPermissionProfile',
        role_key: role,
        permissions: perms[role],
      });
      if (!response.data?.success) {
        toast.error(response.data?.error || 'No se pudo guardar');
        return;
      }
      toast.success(`Permisos de "${role}" guardados correctamente`);
      await loadProfiles();
      reloadPermissions();
    } catch (error) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (checked) => {
    if (!isPlatformAdmin) {
      toast.error('Solo el administrador de plataforma puede activar esta función');
      return;
    }
    setTogglingFeature(true);
    try {
      const response = await base44.functions.invoke('tenantRules', { action: 'adminUpsertTenantRule',
        business_id: businessId,
        rule_key: 'enable_granular_permissions',
        enabled: checked,
        config_json: {},
        notes: checked ? 'Activado desde PermissionAdmin' : 'Desactivado desde PermissionAdmin',
      });
      if (!response.data?.success) {
        toast.error(response.data?.error || 'No se pudo cambiar el estado');
        return;
      }
      setFeatureEnabled(checked);
      toast.success(checked ? 'Permisos granulares activados' : 'Permisos granulares desactivados');
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setTogglingFeature(false);
    }
  };

  if (loadingUser || loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPlatformAdmin && !isBusinessAdmin(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <Shield className="h-12 w-12 text-rose-300" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
        <p className="text-slate-500 text-sm text-center">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-brand-500" /> Permisos por Rol
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configura qué puede ver y hacer cada rol en el sistema.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isPlatformAdmin || isBusinessAdmin(user)) && (
            <Button
              variant="outline"
              onClick={async () => {
                setBackfilling(true);
                try {
                  const res = await base44.functions.invoke('permissions', { action: 'backfillPermissionDefaults',});
                  if (res.data?.success) {
                    toast.success(`Backfill completado: ${res.data.profilesUpdated} perfiles, ${res.data.keysAdded} claves nuevas`);
                    await loadProfiles();
                  } else {
                    toast.error(res.data?.error || 'Error en backfill');
                  }
                } catch (e) {
                  toast.error(`Error: ${e.message}`);
                } finally {
                  setBackfilling(false);
                }
              }}
              disabled={backfilling}
            >
              <Download className={`h-4 w-4 mr-1 ${backfilling ? "animate-spin" : ""}`} />
              {backfilling ? "Aplicando..." : "Aplicar nuevos permisos"}
            </Button>
          )}
          <Button variant="outline" onClick={loadProfiles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </div>

      {isPlatformAdmin && (
        <Card className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">Activar permisos granulares</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cuando está desactivado, se usan los permisos por defecto del sistema.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={featureEnabled ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-100 text-slate-700 border-0"}>
              {featureEnabled ? "Activado" : "Desactivado"}
            </Badge>
            <Switch
              checked={featureEnabled}
              onCheckedChange={handleToggleFeature}
              disabled={togglingFeature}
            />
          </div>
        </Card>
      )}



      <UnifiedPermissionMatrix
        perms={perms}
        onPermChange={handleToggleAction}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}