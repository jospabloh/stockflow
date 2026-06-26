import React from "react";
import { useLicense } from "@/lib/LicenseContext";
import { Button } from "@/components/ui/button";
import { Clock, Lock, AlertTriangle, ExternalLink } from "lucide-react";
import { STOCKFLOW_UPGRADE_URL } from "@/lib/appConfig";

export default function TrialBanner() {
  const { billingStatus, trialDaysLeft, isPlatformAdmin, loading } = useLicense();

  if (loading || isPlatformAdmin) return null;
  if (!billingStatus || billingStatus === "active") return null;

  if (billingStatus === "trial") {
    const urgent = trialDaysLeft !== null && trialDaysLeft <= 5;
    return (
      <div className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm ${
        urgent ? "bg-amber-500 text-white" : "bg-brand-600 text-white"
      }`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium truncate">
            {trialDaysLeft === null
              ? "Estás en período de prueba"
              : trialDaysLeft === 0
              ? "Tu período de prueba termina hoy"
              : trialDaysLeft === 1
              ? "Tu período de prueba termina mañana"
              : `Período de prueba: ${trialDaysLeft} días restantes`}
          </span>
        </div>
        <a href={STOCKFLOW_UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <Button size="sm" variant="secondary" className="whitespace-nowrap text-xs h-7 px-3">
            Ver planes <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </a>
      </div>
    );
  }

  if (billingStatus === "view_only") {
    return (
      <div className="w-full px-4 py-3 flex items-center gap-3 text-sm bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-amber-800 dark:text-amber-300 truncate">
            <span className="font-semibold">Modo Solo Lectura — </span>
            Trial expirado. Solo puedes consultar información.
          </span>
        </div>
        <a href={STOCKFLOW_UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <Button size="sm" className="whitespace-nowrap text-xs h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white border-0">
            Activar <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </a>
      </div>
    );
  }

  if (billingStatus === "suspended") {
    return (
      <div className="w-full px-4 py-3 flex items-center gap-3 text-sm bg-rose-50 border-b border-rose-200 dark:bg-rose-950/30 dark:border-rose-800">
        <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
        <span className="font-semibold text-rose-800 dark:text-rose-300">Negocio suspendido.</span>
        <span className="text-rose-700 dark:text-rose-400">Contacta a soporte para reactivar tu cuenta.</span>
      </div>
    );
  }

  if (billingStatus === "archived") {
    return (
      <div className="w-full px-4 py-3 flex items-center gap-3 text-sm bg-red-600 text-white">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="font-semibold flex-1 min-w-0 truncate">
          Cuenta archivada — Tu negocio será eliminado permanentemente. Contacta soporte para recuperarlo.
        </span>
        <a
          href="mailto:soporte@acaciaco.com.mx"
          className="flex-shrink-0 text-white underline text-xs whitespace-nowrap"
        >
          soporte@acaciaco.com.mx
        </a>
      </div>
    );
  }

  return null;
}
