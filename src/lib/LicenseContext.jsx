import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { userLimitFor } from "@/lib/planLimits";

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Use server-side function for single source of truth
        const response = await base44.functions.invoke('licenses', { action: 'getCurrentTenantLicenseState',});
        setLicense(response.data);
      } catch (_) {
        // Fallback for errors
        setLicense({ is_platform_admin: false, billing_status: null, trial_days_left: null });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isPlatformAdmin = license?.is_platform_admin ?? false;
  const billingStatus = license?.billing_status ?? null;
  const isReadOnly = license?.is_read_only ?? false;
  const trialDaysLeft = license?.trial_days_left ?? null;
  const licensePlan = license?.license_plan ?? "start";
  const activeUserCount = license?.active_user_count ?? null;
  const licensedUserLimit = license?.licensed_user_limit ?? userLimitFor(license?.license_plan);
  const nextRenewalAt = license?.next_renewal_at ?? null;

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
      nextRenewalAt,
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
    licensePlan: "start", activeUserCount: null, licensedUserLimit: userLimitFor("start"), nextRenewalAt: null,
  };
  return ctx;
}