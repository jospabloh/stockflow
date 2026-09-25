import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { businessId, refreshBusiness } = useBusinessContext();
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", address: "" });
  const [referralCode, setReferralCode] = useState("");
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
    try {
      // business_id/role are privileged fields (locked to admin-only writes via
      // field-level RLS on the User entity) — the server-side function
      // validates the caller has no existing business before granting them,
      // instead of the client setting them on itself via updateMe.
      const createResp = await base44.functions.invoke('business', {
        action: 'createBusinessSafe',
        name: createForm.name,
        phone: createForm.phone,
        address: createForm.address,
      });
      if (!createResp?.data?.success) {
        const errCode = createResp?.data?.error;
        if (errCode === 'already_in_a_business') {
          throw new Error('Ya perteneces a un negocio. Un usuario solo puede tener un negocio a la vez.');
        }
        throw new Error(createResp?.data?.error || 'No se pudo crear el negocio');
      }
      const business = createResp.data.business;
      // Initialize 30-day trial using server-side time
      await base44.functions.invoke('licenses', { action: 'initTenantTrial', business_id: business.id }).catch(() => {});
      // Avisa a ACACIA Mission Control en tiempo real (no bloquea el alta). Igual
      // que ticket-pull: sólo viaja el id; MC lee el negocio real por el puente
      // acaciaControl y notifica al dueño de la plataforma y a soporte.
      fetch('https://control.acaciaco.com.mx/api/ingest/tenant-pull', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'stockflow', tenantId: business.id }),
      }).catch(() => {});
      // Seed default permission profiles (admin + almacenista) for the new business
      await base44.functions.invoke('permissions', { action: 'seedDefaultPermissionProfiles',}).catch(() => {});
      // Apply referral code if provided (non-fatal)
      if (referralCode.trim()) {
        const refResult = await base44.functions.invoke('referrals', { action: 'applyReferralCode',
          business_id: business.id,
          referral_code: referralCode.trim(),
        }).catch(() => null);
        if (refResult?.data?.success) {
          toast.success(`¡Código aplicado! +15 días de prueba extra de parte de ${refResult.data.referrer_name}.`);
        }
      }
      await refreshBusiness();
      toast.success("¡Negocio creado! Bienvenido a StockFlow. Tienes 30 días de prueba.");
      navigate("/Dashboard");
    } catch (error) {
      console.error("Create business error:", error);
      const errCode = error?.response?.data?.error || error?.data?.error;
      if (errCode === 'already_in_a_business') {
        toast.error('Ya perteneces a un negocio. Un usuario solo puede tener un negocio a la vez.');
      } else {
        toast.error(`Error: ${error.message || 'Algo salió mal'}`);
      }
    } finally {
      setLoading(false);
    }
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
     try {
       // business_id/role are privileged fields (locked to admin-only writes via
       // field-level RLS on the User entity) — the server-side function
       // authoritatively re-validates the invite code (active, business active)
       // instead of trusting the client's own filter()+updateMe sequence, which
       // could otherwise be skipped entirely to self-assign business_id to any
       // tenant without ever knowing its invite code.
       const joinResp = await base44.functions.invoke('business', {
         action: 'joinBusinessSafe',
         invite_code: code,
       });
       const data = joinResp?.data;
       if (!data?.success) {
         handleJoinFailure(data);
         return;
       }
       const business = data.business;
       // Wait for business context to refresh and verify business_id is updated
       await refreshBusiness();
       // Verify the user's business_id was updated before navigating
       const verifyUser = await base44.auth.me();
       if (verifyUser.business_id !== business.id) {
         throw new Error("Falló la asignación del negocio. Intenta de nuevo.");
       }
       // Only THEN reset loading and navigate
       setLoading(false);
       toast.success(`¡Bienvenido a ${business.name}!`);
       navigate("/Dashboard");
     } catch (error) {
       // functions.invoke throws on non-2xx; the server's error code is in the body.
       const data = error?.response?.data;
       if (data?.error) {
         handleJoinFailure(data);
         return;
       }
       console.error("Join error:", error);
       toast.error(`Error: ${error.message || 'Algo salió mal'}`);
       setLoading(false);
     }
   };

   function handleJoinFailure(data) {
     if (data?.error === 'user_limit_reached') {
       const next = data.next_plan_label ? ` Pide al administrador que suba al plan ${data.next_plan_label}.` : '';
       toast.error(`Este negocio ya usa los ${data.limit} usuarios de su plan.${next}`);
     } else if (data?.error === 'already_in_a_business') {
       toast.error("Tu cuenta ya pertenece a otro negocio.");
     } else if (data?.error === 'code_disabled') {
       toast.error("Este código de invitación está desactivado. Contacta al administrador.");
     } else if (data?.error === 'business_inactive') {
       toast.error("Este negocio no está activo. Contacta al administrador.");
     } else {
       // Only an invalid code counts toward the 5-attempt lockout.
       const attempts = joinAttempts + 1;
       setJoinAttempts(attempts);
       if (attempts >= 5) {
         setJoinCooldown(60);
         toast.error("5 intentos fallidos. Bloqueado por 60 segundos.");
       } else {
         toast.error(`Código no válido. ${5 - attempts} intento(s) restantes.`);
       }
     }
     setLoading(false);
   }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-50/40 flex flex-col items-center justify-center p-4">
      {/* Logo */}
       <div className="flex items-center gap-3 mb-10">
         <img src="https://media.base44.com/images/public/69af971d0fdb362c9ae52ed3/5032b5555_StockFlow_logo.png" alt="StockFlow" className="h-12 w-12 object-contain" />
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
              <button type="button" onClick={() => setMode("create")} className="group w-full text-left">
                <Card className="border-2 border-transparent hover:border-brand-300 hover:shadow-md transition-all p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-200 transition-colors">
                      <Building2 className="h-6 w-6 text-brand-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 mb-0.5">Crear mi negocio</h3>
                      <p className="text-sm text-slate-500">Soy dueño o administrador — iniciaré el espacio de trabajo</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                  </div>
                </Card>
              </button>

              <button type="button" onClick={() => setMode("join")} className="group w-full text-left">
                <Card className="border-2 border-transparent hover:border-accent-300 hover:shadow-md transition-all p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-accent-100 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-200 transition-colors">
                      <Users className="h-6 w-6 text-accent-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 mb-0.5">Unirme a un equipo</h3>
                      <p className="text-sm text-slate-500">Tengo un código de invitación de mi negocio</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-accent-500 transition-colors" />
                  </div>
                </Card>
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <Card className="border-0 shadow-lg p-6 space-y-5">
            <button type="button" onClick={() => setMode(null)} className="text-sm text-slate-400 hover:text-slate-600">← Volver</button>
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
              <div>
                <Label>Código de referido <span className="text-slate-400 text-xs font-normal">(opcional)</span></Label>
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="REF-XXXXXX"
                  className="font-mono tracking-widest"
                  maxLength={10}
                />
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!createForm.name.trim() || loading}
              className="w-full bg-brand-600 hover:bg-brand-700"
            >
              {loading ? "Creando negocio..." : "Crear y Continuar →"}
            </Button>
          </Card>
        )}

        {mode === "join" && (
          <Card className="border-0 shadow-lg p-6 space-y-5">
            <button type="button" onClick={() => setMode(null)} className="text-sm text-slate-400 hover:text-slate-600">← Volver</button>
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
              className="w-full bg-accent-600 hover:bg-accent-700"
            >
              {loading ? "Verificando..." : joinCooldown > 0 ? `Espera ${joinCooldown}s` : "Verificar y Unirse →"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}