import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { LEGACY_DEFAULTS } from "./permissionArtifacts";

const PermissionContext = createContext(null);

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meResult, response] = await Promise.all([
        base44.auth.me(),
        base44.functions.invoke('getPermissionProfiles', {}),
      ]);
      setUserEmail(meResult?.email || null);
      setUserRole(meResult?.role || null);
      const data = response.data;
      setProfiles(data?.profiles || {});
      setFeatureEnabled(data?.featureEnabled === true);
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

  const can = useCallback((artifact, action) => {
    if (userEmail === PLATFORM_OWNER_EMAIL) return true;

    if (!featureEnabled) return legacyCheck(artifact, action, userRole);

    const roleProfile = profiles[userRole];
    if (!roleProfile) return legacyCheck(artifact, action, userRole);

    const artifactProfile = roleProfile[artifact];
    if (!artifactProfile) return legacyCheck(artifact, action, userRole);

    if (artifactProfile[action] === false) return false;
    if (artifactProfile[action] === true) return legacyCheck(artifact, action, userRole);

    return legacyCheck(artifact, action, userRole);
  }, [userEmail, featureEnabled, profiles, userRole]);

  const canSee = useCallback((artifact) => can(artifact, 'ver'), [can]);

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
