import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const bid = u?.business_id || null;
        setBusinessId(bid);
        if (bid) {
          const businesses = await base44.entities.Business.list();
          const biz = businesses?.find(b => b.id === bid) || businesses?.[0];
          if (biz?.name) setBusinessName(biz.name);
        }
      } catch {
        // not logged in or no business
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const refreshBusiness = () => window.location.reload();

  return (
    <BusinessContext.Provider value={{ user, businessId, businessName, isLoading, refreshBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  return useContext(BusinessContext);
}