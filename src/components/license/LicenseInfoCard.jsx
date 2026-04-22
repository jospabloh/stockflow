import React from "react";
import { useLicense } from "@/lib/LicenseContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Lock, AlertTriangle, Zap, Users } from "lucide-react";
import moment from "moment";

const STATUS_CONFIG = {
  trial: { label: "Período de Prueba", icon: Clock, color: "bg-blue-100 text-blue-700" },
  active: { label: "Licencia Activa", icon: CheckCircle, color: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Expirada", icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
  suspended: { label: "Suspendida", icon: Lock, color: "bg-rose-100 text-rose-700" },
};

export default function LicenseInfoCard() {
  const { billingStatus, trialDaysLeft, licensePlan, licensedUserLimit, activeUserCount, loading, nextRenewalAt } = useLicense();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!billingStatus) return null;

  // Normalizar estados: view_only → expired
  const normalizedStatus = billingStatus === "view_only" ? "expired" : billingStatus;
  const cfg = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.active;
  const Icon = cfg.icon;

  return (
    <Card className="border-0 shadow-sm p-6 space-y-4 bg-gradient-to-br from-slate-50 to-white">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-700 text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-500" />
          Información de Licencia
        </h4>
        <Badge className={`${cfg.color} border-0 text-xs flex items-center gap-1`}>
          <Icon className="h-3 w-3" /> {cfg.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estado */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold mb-1">Estado de Facturación</p>
          <p className="text-sm font-medium text-slate-700 capitalize">
            {normalizedStatus === "trial" && "Período de Prueba"}
            {normalizedStatus === "active" && "Licencia Activa"}
            {normalizedStatus === "expired" && "Expirada / Solo Lectura"}
            {normalizedStatus === "suspended" && "Suspendida"}
          </p>
        </div>

        {/* Plan */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold mb-1">Plan</p>
          <p className="text-sm font-medium text-slate-700 capitalize">{licensePlan || "—"}</p>
        </div>

        {/* Límite de usuarios */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold mb-1">Límite de Usuarios</p>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-medium text-slate-700">{licensedUserLimit}</p>
          </div>
        </div>

        {/* Usuarios activos */}
        {activeUserCount !== null && activeUserCount !== undefined && (
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 font-semibold mb-1">Usuarios Activos</p>
            <p className={`text-sm font-medium ${activeUserCount >= licensedUserLimit ? "text-rose-600" : "text-slate-700"}`}>
              {activeUserCount}/{licensedUserLimit}
            </p>
          </div>
        )}

        {/* Fecha de renovación (si está activo) */}
        {normalizedStatus === 'active' && nextRenewalAt && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-emerald-600 font-semibold mb-1">Próxima Renovación</p>
            <p className="text-sm font-medium text-emerald-700">
              {moment(nextRenewalAt).format('DD/MM/YYYY')}
            </p>
          </div>
        )}

        {/* Días restantes (si está en trial) */}
        {normalizedStatus === "trial" && trialDaysLeft !== null && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold mb-1">Días Restantes</p>
            <p className={`text-sm font-medium ${trialDaysLeft <= 5 ? "text-amber-600" : "text-blue-700"}`}>
              {trialDaysLeft === 0 ? "Termina hoy" : `${trialDaysLeft} días`}
            </p>
          </div>
        )}

        {/* Advertencia si expiró */}
        {(normalizedStatus === "expired" || normalizedStatus === "suspended") && (
          <div className="md:col-span-2 p-3 bg-rose-50 rounded-lg border border-rose-200 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">
              {normalizedStatus === "expired" && "Tu período de prueba ha expirado. Modo solo lectura activado."}
              {normalizedStatus === "suspended" && "Tu licencia ha sido suspendida. Contacta a soporte."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}