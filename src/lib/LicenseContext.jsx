import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const { businessId, isLoading: bizLoading } = useBusinessContext();
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bizLoading) return;
    base44.functions.invoke("checkTenantLicense", {})
      .then(r => { setLicense(r.data); })
      .catch(() => {
        // Si falla, bloquear escritura por seguridad (view_only conservador)
        setLicense(businessId ? { billing_status: 'view_only', trial_days_left: null, is_platform_admin: false } : null);
      })
      .finally(() => setLoading(false));
  }, [businessId, bizLoading]);

  const isPlatformAdmin = license?.is_platform_admin ?? false;
  const billingStatus = license?.billing_status ?? null;
  const isReadOnly = !isPlatformAdmin && (billingStatus === "view_only" || billingStatus === "suspended");
  const trialDaysLeft = license?.trial_days_left ?? null;
  const licensePlan = license?.license_plan ?? "start";
  const activeUserCount = license?.active_user_count ?? 0;
  const licensedUserLimit = license?.licensed_user_limit ?? 4;

  return (
    <LicenseContext.Provider value={{
      license,
      loading,
      isPlatformAdmin,
      billingStatus,
      isReadOnly,
      trialDaysLeft,
      licensePlan,
      activeUserCount,
      licensedUserLimit,
    }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) return {
    license: null, loading: false, isPlatformAdmin: false,
    billingStatus: null, isReadOnly: false, trialDaysLeft: null,
    licensePlan: "start", activeUserCount: 0, licensedUserLimit: 4,
  };
  return ctx;
}