import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const LicenseContext = createContext(null);

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Primero obtener el usuario para detectar platform admin
        let user = null;
        try { user = await base44.auth.me(); } catch (_) {}

        if (user?.email === PLATFORM_OWNER_EMAIL) {
          setLicense({ is_platform_admin: true, billing_status: 'active', trial_days_left: null, license_plan: 'pro', licensed_user_limit: 999 });
          setLoading(false);
          return;
        }

        // Leer negocio directamente — RLS del servidor filtra por business_id del token
        let businesses = [];
        try { businesses = await base44.entities.Business.list(); } catch (_) {}
        const biz = businesses?.[0];

        if (!biz) {
          // Sin negocio asignado aún — no mostrar banner
          setLicense({ is_platform_admin: false, billing_status: null, trial_days_left: null });
          setLoading(false);
          return;
        }

        let billingStatus = biz.billing_status || 'trial';
        let trialDaysLeft = null;

        if (billingStatus === 'trial' && biz.trial_end_at) {
          const now = new Date();
          const end = new Date(biz.trial_end_at);
          if (end <= now) {
            billingStatus = 'view_only';
          } else {
            trialDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
          }
        }

        setLicense({ is_platform_admin: false, billing_status: billingStatus, trial_days_left: trialDaysLeft, license_plan: biz.license_plan || 'start', licensed_user_limit: biz.licensed_user_limit || 4 });
      } catch (_) {
        setLicense({ is_platform_admin: false, billing_status: 'trial', trial_days_left: null });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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