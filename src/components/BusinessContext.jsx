import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const bid = u?.business_id || null;
      setBusinessId(bid);
      
      // Load business name if businessId exists
      if (bid) {
        try {
          const businesses = await base44.entities.Business.filter({ id: bid });
          if (businesses.length > 0) {
            setBusinessName(businesses[0].name);
          }
        } catch (e) {
          console.log("Could not load business name:", e.message);
        }
      } else {
        setBusinessName(null);
      }
    } catch {
      setUser(null);
      setBusinessId(null);
      setBusinessName(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const refreshBusiness = useCallback(() => loadUser(), [loadUser]);

  return (
    <BusinessContext.Provider value={{ user, businessId, businessName, isLoading, refreshBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  return useContext(BusinessContext);
}