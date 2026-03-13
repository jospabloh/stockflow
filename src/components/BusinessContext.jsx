import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      setBusinessId(u?.business_id || null);
    } catch {
      setUser(null);
      setBusinessId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const refreshBusiness = useCallback(() => loadUser(), [loadUser]);

  return (
    <BusinessContext.Provider value={{ user, businessId, isLoading, refreshBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  return useContext(BusinessContext);
}