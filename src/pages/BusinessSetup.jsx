import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Users, ArrowRight, Package, Copy, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";

const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BSNS-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { businessId, refreshBusiness } = useBusinessContext();
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", address: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [joinAttempts, setJoinAttempts] = useState(0);
  const [joinCooldown, setJoinCooldown] = useState(0);

  useEffect(() => {
    if (joinCooldown <= 0) return;
    const timer = setTimeout(() => setJoinCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [joinCooldown]);

  useEffect(() => {
    if (businessId) navigate("/Dashboard");
  }, [businessId, navigate]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setLoading(true);
    const code = generateInviteCode();
    const business = await base44.entities.Business.create({
      ...createForm,
      invite_code: code,
      status: "active",
      tax_rate: 16,
      currency: "MXN",
    });
    await base44.auth.updateMe({ business_id: business.id });
    await refreshBusiness();
    toast.success("¡Negocio creado! Bienvenido a StockFlow.");
    navigate("/Dashboard");
    setLoading(false);
  };

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    if (joinCooldown > 0) return;
    if (joinAttempts >= 5) {
      toast.error("Demasiados intentos fallidos. Espera antes de intentar de nuevo.");
      setJoinCooldown(60);
      return;
    }
    setLoading(true);
    const businesses = await base44.entities.Business.filter({ invite_code: code });
    if (businesses.length === 0) {
      const attempts = joinAttempts + 1;
      setJoinAttempts(attempts);
      if (attempts >= 5) {
        setJoinCooldown(60);
        toast.error("5 intentos fallidos. Bloqueado por 60 segundos.");
      } else {
        toast.error(`Código no válido. ${5 - attempts} intento(s) restantes.`);
      }
      setLoading(false);
      return;
    }
    const business = businesses[0];
    await base44.auth.updateMe({ business_id: business.id });
    await refreshBusiness();
    toast.success(`¡Bienvenido a ${business.name}!`);
    navigate("/Dashboard");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-800 text-2xl tracking-tight">StockFlow</h1>
          <p className="text-xs text-slate-400">Control de inventario</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        {!mode && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Configura tu espacio de trabajo</h2>
              <p className="text-slate-500 text-sm">Para comenzar, crea tu negocio o únete a uno existente con un código de invitación.</p>
            </div>
            <div className="space-y-4">
              <button onClick={() => setMode("create")} className="group w-full text-left">
                <Card className="border-2 border-transparent hover:border-indigo-300 hover:shadow-md transition-all p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                      <Building2 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 mb-0.5">Crear mi negocio</h3>
                      <p className="text-sm text-slate-500">Soy dueño o administrador — iniciaré el espacio de trabajo</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </Card>
              </button>

              <button onClick={() => setMode("join")} className="group w-full text-left">
                <Card className="border-2 border-transparent hover:border-cyan-300 hover:shadow-md transition-all p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-200 transition-colors">
                      <Users className="h-6 w-6 text-cyan-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 mb-0.5">Unirme a un equipo</h3>
                      <p className="text-sm text-slate-500">Tengo un código de invitación de mi negocio</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-cyan-500 transition-colors" />
                  </div>
                </Card>
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <Card className="border-0 shadow-lg p-6 space-y-5">
            <button onClick={() => setMode(null)} className="text-sm text-slate-400 hover:text-slate-600">← Volver</button>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">Datos del negocio</h3>
              <p className="text-sm text-slate-500 mt-0.5">Se generará un código de invitación para tu equipo</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Nombre del negocio <span className="text-red-500">*</span></Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Ej: Distribuidora García S.A."
                  autoFocus
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="+52 449 000 0000"
                />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Calle, colonia, ciudad"
                />
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!createForm.name.trim() || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? "Creando negocio..." : "Crear y Continuar →"}
            </Button>
          </Card>
        )}

        {mode === "join" && (
          <Card className="border-0 shadow-lg p-6 space-y-5">
            <button onClick={() => setMode(null)} className="text-sm text-slate-400 hover:text-slate-600">← Volver</button>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">Código de invitación</h3>
              <p className="text-sm text-slate-500 mt-0.5">Pide el código a tu administrador (formato: BSNS-XXXXXX)</p>
            </div>
            <div>
              <Label>Código de acceso</Label>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="BSNS-XXXXXX"
                className="font-mono tracking-widest text-center text-xl h-14"
                maxLength={11}
                autoFocus
              />
            </div>
            {joinCooldown > 0 && (
              <p className="text-sm text-center text-red-500 font-medium">
                Bloqueado por {joinCooldown}s por múltiples intentos fallidos
              </p>
            )}
            <Button
              onClick={handleJoin}
              disabled={inviteCode.length < 6 || loading || joinCooldown > 0}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {loading ? "Verificando..." : joinCooldown > 0 ? `Espera ${joinCooldown}s` : "Verificar y Unirse →"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}