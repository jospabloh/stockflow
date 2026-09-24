import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getDefaultsForRole } from "./permissionRegistry";
import { getPermissionModule } from "./permissionModuleMap";
import { appRole } from "@/lib/roles";

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const [profiles, setProfiles] = useState({});
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // User identity (role/email) is loaded independently of the permissions
    // function. If that function is unavailable, we must still know the user's
    // role so navigation and access checks keep working via the registry's
    // role defaults — otherwise a single failed backend call blanks the app.
    try {
      const meResult = await base44.auth.me();
      setUserEmail(meResult?.email || null);
      setUserRole(appRole(meResult?.role) || null);
    } catch (_) {
      setUserEmail(null);
      setUserRole(null);
    }

    try {
      const response = await base44.functions.invoke('permissions', { action: 'getPermissionProfiles',});
      const data = response.data;
      setProfiles(data?.profiles || {});
      setFeatureEnabled(data?.featureEnabled === true);
      setIsPlatformAdmin(data?.is_platform_admin === true);
    } catch (_) {
      // Permissions service unavailable → fall back to the registry's role defaults.
      setProfiles({});
      setFeatureEnabled(false);
      setIsPlatformAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Defaults del rol actual según el registro (única fuente de verdad —
  // src/lib/permissionRegistry.js). El mismo cálculo que usa el backend para
  // sembrar/backfillear perfiles (ver base44/functions/permissions), así que
  // un perfil guardado que aún no tiene una clave puntual cae en el default
  // correcto en vez de en una copia aparte que puede desincronizarse.
  const roleDefaults = useMemo(() => getDefaultsForRole(userRole), [userRole]);

  const can = useCallback((pageName, action = 'view') => {
    if (isPlatformAdmin) return true;

    // Admin siempre tiene acceso completo
    if (userRole === 'admin') return true;

    // Mapear nombre de página a módulo de permisos (ej: "Products" -> "Productos")
    const moduleName = getPermissionModule(pageName);
    const key = `${moduleName}:${action}`;

    const roleProfile = profiles[userRole];
    const storedPerm = roleProfile?.[key];
    if (storedPerm === true) return true;
    if (storedPerm === false) return false;

    return roleDefaults[key] === true;
  }, [isPlatformAdmin, profiles, userRole, roleDefaults]);

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