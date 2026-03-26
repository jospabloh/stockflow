import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [businessNameLocked, setBusinessNameLocked] = useState(false); // MITIGATION: don't display until exact match confirmed
  const lastUserEmailRef = useRef(null);
  const lastBusinessIdRef = useRef(null);

  const loadUser = useCallback(async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const bid = u?.business_id || null;
      
      // CRITICAL: Always reload business name if business_id changed
      if (bid !== lastBusinessIdRef.current) {
        console.log(`[BusinessContext] business_id changed: ${lastBusinessIdRef.current} → ${bid}`);
        lastBusinessIdRef.current = bid;
      }
      
      setBusinessId(bid);
      
      // Load business name if businessId exists
      if (bid) {
        try {
          // Use backend function to fetch business without RLS restrictions
          // This prevents infinite loop when user doesn't own the business record
          const response = await fetch('/api/functions/getBusinessName', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ business_id: bid })
          });
          const result = await response.json();
          
          if (result.success && result.business_name) {
            setBusinessName(result.business_name);
            setBusinessNameLocked(true);
            console.log(`[BusinessContext] ✓ [LOCKED] Business name verified: "${result.business_name}" (ID: ${bid}) for user ${u?.email}`);
          } else {
            console.log(`[BusinessContext] ✗ Could not load business name for ID ${bid}: ${result.error}`);
            setBusinessName(null);
            setBusinessNameLocked(false);
          }
        } catch (e) {
          console.log("[BusinessContext] Error loading business name:", e.message);
          setBusinessName(null);
          setBusinessNameLocked(false);
        }
      } else {
        console.log(`[BusinessContext] No business_id for user ${u?.email}`);
        setBusinessName(null);
        setBusinessNameLocked(false);
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

  // CRITICAL FIX: Detect business_id changes and reload immediately
  useEffect(() => {
    if (businessId && businessId !== lastBusinessIdRef.current) {
      console.log(`[BusinessContext] business_id changed to ${businessId}, reloading business name`);
      loadUser();
    }
  }, [businessId, loadUser]);

  const refreshBusiness = useCallback(() => {
    console.log("[BusinessContext] Manual refresh triggered");
    loadUser();
  }, [loadUser]);

  return (
    <BusinessContext.Provider value={{ user, businessId, businessName, businessNameLocked, isLoading, refreshBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  return useContext(BusinessContext);
}