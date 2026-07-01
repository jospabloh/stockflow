import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { LEGACY_DEFAULTS } from "./permissionArtifacts";
import { getPermissionModule } from "./permissionModuleMap";

const PermissionContext = createContext(null);

function legacyCheck(artifact, action, role) {
  const roleDefaults = LEGACY_DEFAULTS[role];
  if (!roleDefaults) return false;
  const artifactDefaults = roleDefaults[artifact];
  if (!artifactDefaults) return false;
  return artifactDefaults[action] === true;
}

export function PermissionProvider({ children }) {
  const [profiles, setProfiles] = useState({});
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meResult, response] = await Promise.all([
        base44.auth.me(),
        base44.functions.invoke('permissions', { action: 'getPermissionProfiles',}),
      ]);
      setUserEmail(meResult?.email || null);
      setUserRole(meResult?.role || null);
      const data = response.data;
      setProfiles(data?.profiles || {});
      setFeatureEnabled(data?.featureEnabled === true);
      setIsPlatformAdmin(data?.is_platform_admin === true);
    } catch (_) {
      setProfiles({});
      setFeatureEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback((pageName, action = 'ver') => {
    if (isPlatformAdmin) return true;

    // Admin siempre tiene acceso completo
    if (userRole === 'admin') return true;

    // Mapear nombre de página a módulo de permisos (ej: "Products" -> "Productos")
    const moduleName = getPermissionModule(pageName);

    if (!featureEnabled) return legacyCheck(moduleName, action, userRole);

    const roleProfile = profiles[userRole];
    if (!roleProfile) return legacyCheck(moduleName, action, userRole);

    // Nuevo formato: claves como "Productos:view" o "Productos:create"
    const newFormatKey = `${moduleName}:${action}`;
    const newFormatPerm = roleProfile[newFormatKey];
    if (newFormatPerm === true) return true;
    if (newFormatPerm === false) return false;

    // Formato legacy: el perfil guardado en BD usa nombre de página en inglés
    // y acciones en español (ver, escribir, modificar, eliminar)
    const legacyRoleObj = roleProfile[pageName] || roleProfile[moduleName] || {};

    // Mapa de acciones nuevas -> acciones legacy
    const ACTION_MAP = {
      view: 'ver',
      create: 'escribir',
      edit_name: 'modificar',
      edit_description: 'modificar',
      edit_stock_quantity: 'modificar',
      edit_min_stock: 'modificar',
      edit_sku: 'modificar',
      edit_retail_price: 'modificar',
      edit_wholesale_price: 'modificar',
      edit_cost_price: 'modificar',
      delete: 'eliminar',
      entry: 'escribir',
      exit: 'escribir',
      return: 'modificar',
      adjustment: 'modificar',
      confirm_payment: 'modificar',
      convert: 'escribir',
      cancel: 'eliminar',
      send: 'modificar',
      export: 'leer',
      pricing: 'leer',
      edit_items: 'modificar',
      edit_quantities: 'modificar',
      edit_prices: 'modificar',
      edit_client: 'modificar',
      edit_notes: 'modificar',
      edit_payment_method: 'modificar',
    };

    const legacyAction = ACTION_MAP[action] || action;
    const legacyPerm = legacyRoleObj[legacyAction] ?? legacyRoleObj[action];

    if (legacyPerm === true) return true;
    if (legacyPerm === false) return false;

    // Fallback final
    return legacyCheck(moduleName, action, userRole);
  }, [isPlatformAdmin, featureEnabled, profiles, userRole]);

  const canSee = useCallback((pageName) => can(pageName, 'view'), [can]);

  return (
    <PermissionContext.Provider value={{
      profiles,
      featureEnabled,
      loading,
      reload: load,
      can,
      canSee,
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) return {
    profiles: {},
    featureEnabled: false,
    loading: false,
    reload: () => {},
    can: () => true,
    canSee: () => true,
  };
  return ctx;
}