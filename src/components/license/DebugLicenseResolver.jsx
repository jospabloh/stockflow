import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bug } from "lucide-react";

export default function DebugLicenseResolver() {
  const [debug, setDebug] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDebug = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('debugCurrentTenantLicense', {});
      setDebug(res.data);
      console.log('Debug result:', res.data);
    } catch (err) {
      setDebug({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDebugFilter = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('debugBusinessFilter', {});
      setDebug(res.data);
      console.log('Filter debug result:', res.data);
    } catch (err) {
      setDebug({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-rose-300 bg-rose-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-rose-800">Debug: Tenant Resolution</h4>
          <p className="text-xs text-rose-700 mt-1">Click below to verify which tenant is being resolved by the backend.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleDebug}
          disabled={loading}
          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
        >
          {loading ? "Debugging..." : "1. Debug Tenant"}
        </Button>
        <Button
          onClick={handleDebugFilter}
          disabled={loading}
          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
        >
          {loading ? "Debugging..." : "2. Debug Filter"}
        </Button>
      </div>

      {debug && (
        <div className="bg-white rounded p-3 border border-rose-200 max-h-96 overflow-auto">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}