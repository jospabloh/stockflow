import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Check, X, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Solicitudes para unirse con el código de invitación (2026-09-30). Unirse con
// el código ya no da acceso: el solicitante queda pendiente hasta que un
// administrador lo aprueba aquí y elige su rol. El servidor
// (business:resolveJoinRequest) vuelve a comprobar rol, permiso, negocio y
// cupo del plan; esta pantalla solo lo pide.
const ROLE_OPTIONS = [
  { value: "almacenista", label: "Almacenista" },
  { value: "admin", label: "Admin" },
];

const REASONS = {
  user_limit_reached: (d) => {
    const next = d.next_plan_label ? ` Sube al plan ${d.next_plan_label} para aprobar más.` : "";
    return `Tu plan incluye ${d.limit} usuarios y ya los usas.${next}`;
  },
  requester_unavailable: () => "Esa persona ya pertenece a otro negocio o borró su cuenta. La solicitud se descartó.",
  request_not_pending: () => "Esa solicitud ya fue resuelta.",
  request_not_found: () => "No se encontró la solicitud.",
  business_inactive: () => "Tu negocio no está activo.",
};

export default function JoinRequestsManager({ businessId, onApproved }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await base44.functions.invoke("business", { action: "listJoinRequests" });
      setRequests(resp.data?.requests || []);
    } catch {
      toast.error("No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) load();
  }, [businessId]);

  const resolve = async (req, decision) => {
    setBusyId(req.id);
    try {
      const resp = await base44.functions.invoke("business", {
        action: "resolveJoinRequest",
        request_id: req.id,
        decision,
        role: roles[req.id] || "almacenista",
      });
      if (!resp.data?.success) throw new Error(resp.data?.error || "No se pudo resolver");
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      const who = req.user_name || req.user_email;
      if (decision === "approve") {
        toast.success(`${who} ya es parte del equipo`);
        onApproved?.();
      } else {
        toast.success(`Solicitud de ${who} rechazada`);
      }
    } catch (error) {
      // functions.invoke lanza en no-2xx; el motivo viene en el cuerpo.
      const data = error?.response?.data;
      const reason = data?.error && REASONS[data.error] ? REASONS[data.error](data) : (data?.error || error.message);
      toast.error(reason || "No se pudo resolver la solicitud");
      if (data?.error === "requester_unavailable" || data?.error === "request_not_pending") load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-700 text-lg">Solicitudes para unirse</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Quien use el código de invitación queda pendiente y no ve nada hasta que lo apruebes. Tú eliges su rol.
          </p>
        </div>
        <button type="button" onClick={load} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {loading ? null : requests.length === 0 ? (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> No hay solicitudes pendientes.
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {requests.map((req, idx) => {
            const busy = busyId === req.id;
            return (
              <div
                key={req.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${idx < requests.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm font-medium text-slate-700 truncate">{req.user_name || "Sin nombre"}</p>
                  <p className="text-xs text-slate-400 truncate">{req.user_email}</p>
                </div>
                <select
                  value={roles[req.id] || "almacenista"}
                  disabled={busy}
                  onChange={(e) => setRoles((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  aria-label={`Rol para ${req.user_email}`}
                  className="h-8 px-2 text-xs rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Button size="sm" disabled={busy} onClick={() => resolve(req, "approve")} className="h-8 bg-brand-600 hover:bg-brand-700">
                  <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve(req, "reject")} className="h-8">
                  <X className="h-3.5 w-3.5 mr-1" /> Rechazar
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
