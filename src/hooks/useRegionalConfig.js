/**
 * useRegionalConfig — loads and caches the business timezone/locale from AppSettings.
 * Stores values in localStorage so they're available synchronously via dateUtils.
 */
import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";

export function useRegionalConfig() {
  const { businessId } = useBusinessContext();

  useEffect(() => {
    if (!businessId) return;
    base44.entities.AppSettings.filter({ business_id: businessId }).then((sets) => {
      if (sets.length > 0) {
        const s = sets[0];
        if (s.timezone) localStorage.setItem("sf_timezone", s.timezone);
        if (s.locale) localStorage.setItem("sf_locale", s.locale);
      }
    }).catch(() => {});
  }, [businessId]);
}