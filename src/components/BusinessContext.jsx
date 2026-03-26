import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastUserEmailRef = useRef(null);

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
            console.log(`[BusinessContext] ✓ Loaded business "${businesses[0].name}" for user ${u?.email}`);
          } else {
            console.log(`[BusinessContext] ✗ No business found for ID ${bid}`);
            setBusinessName(null);
          }
        } catch (e) {
          console.log("[BusinessContext] Error loading business name:", e.message);
          setBusinessName(null);
        }
      } else {
        console.log(`[BusinessContext] No business_id for user ${u?.email}`);
        setBusinessName(null);
      }
    } catch (err) {
      console.log("[BusinessContext] Error loading user:", err.message);
      setUser(null);
      setBusinessId(null);
      setBusinessName(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Detect user changes and reload context
  useEffect(() => {
    if (user?.email && user.email !== lastUserEmailRef.current) {
      console.log(`[BusinessContext] User changed from ${lastUserEmailRef.current} to ${user.email}, reloading context`);
      lastUserEmailRef.current = user.email;
      loadUser();
    }
  }, [user?.email, loadUser]);

  const refreshBusiness = useCallback(() => {
    console.log("[BusinessContext] Manual refresh triggered");
    loadUser();
  }, [loadUser]);

  return (
    <BusinessContext.Provider value={{ user, businessId, businessName, isLoading, refreshBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  return useContext(BusinessContext);
}