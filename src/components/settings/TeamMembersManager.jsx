import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, User, RefreshCw, ChevronDown } from "lucide-react";

const ROLE_LABELS = {
  admin: { label: "Admin", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  almacenista: { label: "Almacenista", color: "bg-amber-100 text-amber-700 border-amber-200" },
};

export default function TeamMembersManager({ businessId, currentUserId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [changingRole, setChangingRole] = useState(null);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const users = await base44.asServiceRole
        ? base44.entities.User.filter({ business_id: businessId })
        : base44.entities.User.filter({ business_id: businessId });
      setMembers(users.sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return (a.full_name || "").localeCompare(b.full_name || "");
      }));
    } catch (e) {
      toast.error("No se pudieron cargar los miembros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) loadMembers();
  }, [businessId]);

  const handleRoleChange = async (member, newRole) => {
    if (member.id === currentUserId) {
      toast.error("No puedes cambiar tu propio rol");
      return;
    }
    setChangingRole(member.id);
    try {
      const resp = await base44.functions.invoke("changeUserRole", {
        target_user_id: member.id,
        new_role: newRole,
      });
      if (!resp.data?.success) {
        toast.error(resp.data?.error || "Error al cambiar rol");
        return;
      }
      setMembers(prev =>
        prev.map(m => m.id === member.id ? { ...m, role: newRole } : m)
      );
      toast.success(`${member.full_name || member.email} ahora es ${ROLE_LABELS[newRole]?.label || newRole}`);
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setChangingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length} miembro{members.length !== 1 ? "s" : ""} en este negocio</p>
        <button onClick={loadMembers} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Actualizar
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {members.map((member, idx) => {
          const isSelf = member.id === currentUserId;
          const role = member.role || "almacenista";
          const roleInfo = ROLE_LABELS[role] || { label: role, color: "bg-slate-100 text-slate-600 border-slate-200" };
          const isBusy = changingRole === member.id;

          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 px-4 py-3 ${idx < members.length - 1 ? "border-b border-border" : ""} ${isSelf ? "bg-indigo-50/40" : ""}`}
            >
              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {member.full_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || "?"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {member.full_name || "Sin nombre"}
                    {isSelf && <span className="ml-1 text-xs text-slate-400">(tú)</span>}
                  </p>
                </div>
                <p className="text-xs text-slate-400 truncate">{member.email}</p>
              </div>

              {/* Role badge + change */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>

                {!isSelf && (
                  <div className="relative">
                    <select
                      value={role}
                      disabled={isBusy}
                      onChange={(e) => handleRoleChange(member, e.target.value)}
                      className="appearance-none h-7 pl-2 pr-6 text-xs rounded-md border border-slate-200 bg-white text-slate-600 cursor-pointer hover:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                    >
                      <option value="almacenista">Almacenista</option>
                      <option value="admin">Admin</option>
                    </select>
                    {isBusy
                      ? <RefreshCw className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-slate-400 animate-spin pointer-events-none" />
                      : <ChevronDown className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    }
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        <ShieldCheck className="inline h-3 w-3 mr-0.5" /> Los cambios de rol toman efecto en el próximo inicio de sesión del usuario.
      </p>
    </div>
  );
}