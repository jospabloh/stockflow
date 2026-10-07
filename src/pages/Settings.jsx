import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Building2, FileText, Upload, AlertTriangle, RefreshCw, Copy, Key, UserX, RotateCcw, Trash2, Globe, PackageSearch, Minus, ShieldCheck, History, Gift, Download, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createButtonProps } from "@/lib/a11y";
import ImportProducts from "@/components/settings/ImportProducts";
import TeamMembersManager from "@/components/settings/TeamMembersManager";
import JoinRequestsManager from "@/components/settings/JoinRequestsManager";
import ReferralPanel from "@/components/settings/ReferralPanel";
import BusinessRulesPanel from "@/components/settings/BusinessRulesPanel";
import { useBusinessContext } from "@/components/BusinessContext";
import LicenseInfoCard from "@/components/license/LicenseInfoCard";
import { useLicense } from "@/lib/LicenseContext";
import { nextPlanFor } from "@/lib/planLimits";
import { toast } from "sonner";

export default function Settings() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [settings, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [business, setBusiness] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [rfcSaved, setRfcSaved] = useState(false);
  const [confirmDeleteRfc, setConfirmDeleteRfc] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(0); // 0: initial, 1: warning, 2: confirm
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [teamRefresh, setTeamRefresh] = useState(0);
  const [_diagnosticBusinessId, setDiagnosticBusinessId] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  // Corrección de inventario: nunca automática; requiere diálogo de confirmación + motivo.
  const [pendingCorrection, setPendingCorrection] = useState(null); // { d, mode }
  const [correctionReason, setCorrectionReason] = useState("");
  const [fixingProductId, setFixingProductId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(`sf_audit_dismissed_${businessId}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const dismissProduct = (productId) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(productId);
      try { localStorage.setItem(`sf_audit_dismissed_${businessId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  useEffect(() => {
     const checkAndLoadSettings = async () => {
       try {
         const u = await base44.auth.me();
         setDiagnosticBusinessId(businessId);
         setCurrentUserId(u?.id);
         setCurrentUserRole(u?.role ?? null);
         setCheckingAuth(false);



         // CRITICAL FIX: Filter ALL by business_id, never use list() without filtering
         const [sets] = await Promise.all([
           businessId ? base44.entities.AppSettings.filter({ business_id: businessId }) : Promise.resolve([]),
           ]);
           if (sets.length > 0) {
         setSettings(sets[0]);
         setSettingsId(sets[0].id);
         setRfcSaved(!!sets[0].rfc);
         } else {
         setSettings({
           business_name: "", logo_url: "", primary_color: "#4F46E5",
           secondary_color: "#06B6D4", tax_rate: 16, currency: "MXN",
           low_stock_email: "", quotation_footer: "", address: "", phone: "", rfc: "",
         });
         }

       // Load business entity for invite code
       if (businessId) {
         const list = await base44.entities.Business.filter({ id: businessId });
         // CRITICAL: Find exact match to avoid RLS filter bug
         const exactBusiness = list.find(b => b.id === businessId);
         if (exactBusiness) setBusiness(exactBusiness);
       }
       } catch (err) {
       console.error("Error loading settings:", err);
       } finally {
       setLoading(false);
       }
       };

       checkAndLoadSettings();
       }, [businessId]);

  // Module 7 — self-service data export. Goes through the `business` Safe
  // function (permission key `Configuracion:export_data`, re-checked
  // server-side), then turns the response into a client-side download; no
  // server-side file storage is involved.
  const handleExportData = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke('business', { action: 'exportBusinessData' });
      if (!response.data?.success) {
        toast.error(`No se pudo exportar: ${response.data?.error || 'error desconocido'}`);
        return;
      }
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `stockflow-${settings?.business_name || 'negocio'}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (response.data.errors) {
        toast.warning('Se exportaron tus datos, pero algunas secciones fallaron. Revisa "errors" en el archivo.');
      } else {
        toast.success('Datos exportados');
      }
    } catch (error) {
      toast.error(`No se pudo exportar: ${error.message || 'Intenta de nuevo'}`);
    } finally {
      setExporting(false);
    }
  };

  const validateRFC = (rfc) => {
    if (!rfc) return true; // optional
    return /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc.trim().toUpperCase());
  };

  const handleSaveSettings = async () => {
    if (settings?.rfc && !validateRFC(settings.rfc)) {
      toast.error("RFC inválido. Formato esperado: XAXX010101000 (12 o 13 caracteres).");
      return;
    }
    setSaving(true);
    try {
      if (settingsId) {
        const response = await base44.functions.invoke('business', { action: 'updateAppSettingsSafe',
          settings_id: settingsId,
          updates: settings
        });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error || 'No se pudo guardar'}`);
          setSaving(false);
          return;
        }
      } else {
        const response = await base44.functions.invoke('business', { action: 'createAppSettingsSafe',
          business_id: businessId,
          settings
        });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error || 'No se pudo guardar'}`);
          setSaving(false);
          return;
        }
        setSettingsId(response.data.settings_id);
      }
      setRfcSaved(!!settings?.rfc);
      toast.success("✓ Configuración guardada exitosamente", {
        duration: 4000,
        icon: "✓",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast.error(`Error al guardar: ${error.message || 'Intenta de nuevo'}`);
    } finally {
      setSaving(false);
    }
  };



  const updateSettings = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));

  const handleToggleInviteCode = async (active) => {
    if (!business) return;
    const response = await base44.functions.invoke('business', { action: 'updateBusinessSafe',
      business_id: business.id,
      updates: { invite_code_active: active }
    });
    if (!response.data.success) {
      toast.error(`Error: ${response.data.error || 'No se pudo actualizar'}`);
      return;
    }
    setBusiness({ ...business, invite_code_active: active });
    toast.success(active ? "Código de invitación activado" : "Código desactivado — nadie nuevo podrá unirse");
  };

  const handleRotateInviteCode = async () => {
    if (!business) return;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "BSNS-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const response = await base44.functions.invoke('business', { action: 'updateBusinessSafe',
      business_id: business.id,
      updates: { invite_code: code }
    });
    if (!response.data.success) {
      toast.error(`Error: ${response.data.error || 'No se pudo renovar el código'}`);
      return;
    }
    setBusiness({ ...business, invite_code: code });
    toast.success("Código renovado. El código anterior ya no funciona.");
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateSettings("logo_url", file_url);
    setUploadingLogo(false);
    toast.success("Logo subido correctamente");
  };

  if (loading || checkingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  const canBusiness = can('Configuracion', 'edit_company_name');
  const canSat = can('Configuracion', 'edit_company_rfc');
  const canTeam = can('Configuracion', 'manage_team');
  const canImport = can('Configuracion', 'import_products');
  const canDeleteAccount = can('Configuracion', 'delete_account');
  const canExportData = can('Configuracion', 'export_data');
  // The "Cuenta" tab holds both the export (Module 7's data export) and the
  // irreversible delete — either permission alone is enough to need the tab.
  const canAccountTab = canDeleteAccount || canExportData;
  const canAuditInventory = can('Configuracion', 'audit_inventory');
  // Solo owner/admin del negocio pueden corregir (el servidor lo vuelve a exigir).
  const canCorrectInventory = currentUserRole === 'owner' || currentUserRole === 'admin';

  const applyCorrection = async () => {
    if (!pendingCorrection) return;
    const { d, mode } = pendingCorrection;
    setFixingProductId(d.product_id);
    try {
      // Ojo: 'action' lo usa el router; el modo de corrección viaja en 'mode'.
      await base44.functions.invoke('products', {
        action: 'applyInventoryAuditCorrection',
        mode,
        product_id: d.product_id,
        expected_stock: d.expected_stock,
        current_stock: d.current_stock,
        reason: correctionReason.trim(),
        confirm: true,
      });
      toast.success(mode === 'accept_current'
        ? `${d.product}: stock actual (${d.current_stock}) aceptado y registrado`
        : `${d.product}: stock corregido a ${d.expected_stock}`);
      dismissProduct(d.product_id);
      setPendingCorrection(null);
      setCorrectionReason("");
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast.error(`Error: ${msg}`);
    } finally {
      setFixingProductId(null);
    }
  };
  const canReferrals = can('Configuracion', 'manage_referral');
  // Reglas del negocio: solo su admin (el servidor lo vuelve a exigir).
  const canRules = canCorrectInventory;
  const canViewConfig = can('Configuracion', 'view');
  const anyConfigTab = canBusiness || canSat || canTeam || canImport || canAccountTab || canAuditInventory || canReferrals || canRules;
  const defaultTab = canBusiness ? 'business' : (canSat ? 'sat' : (canTeam ? 'team' : (canImport ? 'import' : (canAccountTab ? 'account' : (canAuditInventory ? 'inventario' : (canReferrals ? 'referidos' : (canRules ? 'reglas' : 'clients')))))));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1 select-none">
          {canViewConfig && anyConfigTab && (
            <>
              {canBusiness && <TabsTrigger value="business"><Building2 className="h-4 w-4 mr-1" /> Negocio</TabsTrigger>}
              {canSat && <TabsTrigger value="sat"><FileText className="h-4 w-4 mr-1" /> Facturación</TabsTrigger>}
              {canTeam && <TabsTrigger value="team"><Key className="h-4 w-4 mr-1" /> Equipo</TabsTrigger>}
              {canImport && <TabsTrigger value="import"><Upload className="h-4 w-4 mr-1" /> Importar</TabsTrigger>}
              {canAccountTab && <TabsTrigger value="account"><UserX className="h-4 w-4 mr-1" /> Cuenta</TabsTrigger>}
              {canAuditInventory && <TabsTrigger value="inventario"><PackageSearch className="h-4 w-4 mr-1" /> Audit Inventario</TabsTrigger>}
              {canReferrals && <TabsTrigger value="referidos"><Gift className="h-4 w-4 mr-1" /> Referidos</TabsTrigger>}
              {canRules && <TabsTrigger value="reglas"><ShieldCheck className="h-4 w-4 mr-1" /> Reglas</TabsTrigger>}
            </>
          )}
        </TabsList>

        {/* Business Settings — Admin only */}
        {canBusiness && <TabsContent value="business">
          <Card className="border-0 shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-slate-700 text-lg">Información del Negocio</h3>
            {(!settings?.rfc || settings?.business_name === "Mi Negocio" || !settings?.business_name) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Configuración incompleta</p>
                  {!settings?.business_name || settings?.business_name === "Mi Negocio" ? <p>• Actualiza el <strong>nombre del negocio</strong> con el nombre real.</p> : null}
                  {!settings?.rfc ? <p>• Registra el <strong>RFC</strong> en la pestaña SAT 4.0 para que aparezca en cotizaciones (requerido fiscalmente).</p> : null}
                </div>
              </div>
            )}
            {/* Logo Upload */}
            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl">
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-white">
                {settings?.logo_url
                  ? <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                  : <Building2 className="h-8 w-8 text-slate-300" />
                }
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Logo del negocio</p>
                <p className="text-xs text-slate-400">Se usará en cotizaciones y documentos</p>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  <span className="inline-flex items-center gap-2 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors">
                    <Upload className="h-3 w-3" />
                    {uploadingLogo ? "Subiendo..." : "Subir logo"}
                  </span>
                </label>
                {settings?.logo_url && (
                  <button type="button" onClick={() => updateSettings("logo_url", "")} className="block text-xs text-red-400 hover:text-red-600">
                    Quitar logo
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre del negocio</Label>
                <Input value={settings?.business_name || ""} onChange={(e) => updateSettings("business_name", e.target.value)} placeholder="Mi Negocio" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={settings?.phone || ""} onChange={(e) => updateSettings("phone", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Dirección</Label>
                <Input value={settings?.address || ""} onChange={(e) => updateSettings("address", e.target.value)} />
              </div>
              <div>
                <Label>RFC del negocio</Label>
                <Input value={settings?.rfc || ""} onChange={(e) => updateSettings("rfc", e.target.value.toUpperCase())} placeholder="XAXX010101000" />
              </div>
              <div>
                <Label>Tasa IVA (%)</Label>
                <Input type="number" value={settings?.tax_rate || 16} onChange={(e) => updateSettings("tax_rate", parseFloat(e.target.value))} />
              </div>
              <div>
                <Label>Moneda</Label>
                <Input value={settings?.currency || "MXN"} onChange={(e) => updateSettings("currency", e.target.value)} />
              </div>
              <div>
                <Label>Email para alertas de stock bajo</Label>
                <Input value={settings?.low_stock_email || ""} onChange={(e) => updateSettings("low_stock_email", e.target.value)} placeholder="admin@email.com" />
              </div>
              <div>
                <Label>Color primario</Label>
                <div className="flex gap-2">
                  <Input type="color" value={settings?.primary_color || "#4F46E5"} onChange={(e) => updateSettings("primary_color", e.target.value)} className="w-14 h-10 p-1" />
                  <Input value={settings?.primary_color || "#4F46E5"} onChange={(e) => updateSettings("primary_color", e.target.value)} />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Texto al pie de cotizaciones</Label>
                <Textarea value={settings?.quotation_footer || ""} onChange={(e) => updateSettings("quotation_footer", e.target.value)} placeholder="Vigencia, condiciones..." rows={2} />
              </div>
            </div>

            {/* Regional settings */}
            <div className="border-t border-border pt-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-brand-500" />
                <h4 className="font-semibold text-slate-700 text-sm">Región y Zona Horaria</h4>
              </div>
              <p className="text-xs text-muted-foreground">Configura la zona horaria y el formato regional para que filtros de fechas, reportes y calendarios usen los valores correctos para tu país.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Zona horaria</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={settings?.timezone || "America/Mexico_City"}
                    onChange={(e) => { updateSettings("timezone", e.target.value); localStorage.setItem("sf_timezone", e.target.value); }}
                  >
                    <option value="America/Mexico_City">🇲🇽 México — Ciudad de México (CST/CDT)</option>
                    <option value="America/Monterrey">🇲🇽 México — Monterrey (CST)</option>
                    <option value="America/Tijuana">🇲🇽 México — Tijuana (PST/PDT)</option>
                    <option value="America/Cancun">🇲🇽 México — Cancún (EST)</option>
                    <option value="America/New_York">🇺🇸 EE.UU. — Nueva York (EST)</option>
                    <option value="America/Chicago">🇺🇸 EE.UU. — Chicago (CST)</option>
                    <option value="America/Los_Angeles">🇺🇸 EE.UU. — Los Ángeles (PST)</option>
                    <option value="America/Bogota">🇨🇴 Colombia — Bogotá</option>
                    <option value="America/Lima">🇵🇪 Perú — Lima</option>
                    <option value="America/Santiago">🇨🇱 Chile — Santiago</option>
                    <option value="America/Argentina/Buenos_Aires">🇦🇷 Argentina — Buenos Aires</option>
                    <option value="America/Sao_Paulo">🇧🇷 Brasil — São Paulo</option>
                    <option value="Europe/Madrid">🇪🇸 España — Madrid</option>
                    <option value="UTC">🌐 UTC</option>
                  </select>
                </div>
                <div>
                  <Label>Formato regional (idioma y fechas)</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={settings?.locale || "es-MX"}
                    onChange={(e) => { updateSettings("locale", e.target.value); localStorage.setItem("sf_locale", e.target.value); }}
                  >
                    <option value="es-MX">Español — México (DD/MM/AAAA)</option>
                    <option value="es-CO">Español — Colombia</option>
                    <option value="es-PE">Español — Perú</option>
                    <option value="es-CL">Español — Chile</option>
                    <option value="es-AR">Español — Argentina</option>
                    <option value="es-ES">Español — España</option>
                    <option value="pt-BR">Português — Brasil</option>
                    <option value="en-US">English — United States (MM/DD/YYYY)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving} className="bg-brand-600 hover:bg-brand-700" {...createButtonProps('save')}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </Card>
          </TabsContent>}



        {/* Facturación — Admin only */}
        {canSat && <TabsContent value="sat">
          <Card className="border-0 shadow-sm overflow-hidden">
            {/* Under construction game section */}
            <div className="relative bg-gradient-to-br from-brand-900 via-purple-900 to-slate-900 p-8 flex flex-col items-center justify-center min-h-[360px] overflow-hidden">
              {/* Animated stars */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="absolute rounded-full bg-white animate-pulse"
                    style={{
                      width: Math.random() * 3 + 1 + "px",
                      height: Math.random() * 3 + 1 + "px",
                      top: Math.random() * 100 + "%",
                      left: Math.random() * 100 + "%",
                      animationDelay: Math.random() * 3 + "s",
                      animationDuration: Math.random() * 2 + 1.5 + "s",
                      opacity: Math.random() * 0.7 + 0.3,
                    }}
                  />
                ))}
              </div>

              {/* Rocket */}
              <div className="text-7xl mb-4 animate-bounce" style={{ animationDuration: "1.8s" }}>🚀</div>

              <h2 className="text-white text-2xl font-bold mb-2 text-center">En Construcción</h2>
              <p className="text-brand-200 text-base text-center mb-1 font-medium">¡Estamos trabajando en algo genial!</p>
              <p className="text-brand-300 text-sm text-center max-w-sm">
                El módulo de <strong className="text-white">Facturación Electrónica (CFDI 4.0)</strong> estará disponible muy pronto. Mientras tanto, puedes registrar tus datos fiscales abajo.
              </p>

              {/* Mini progress bar game */}
              <div className="mt-6 w-64">
                <div className="flex justify-between text-xs text-brand-300 mb-1">
                  <span>Progreso de desarrollo</span>
                  <span>42%</span>
                </div>
                <div className="h-3 bg-brand-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-400 to-brand-400 rounded-full" style={{ width: "42%", animation: "progressFill 2s ease-out forwards" }} />
                </div>
              </div>
            </div>

            {/* Fiscal data form below */}
            <div className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-700 text-lg">Datos Fiscales</h3>
              {!settings?.rfc && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">RFC del negocio no registrado — las cotizaciones generadas no son fiscalmente válidas ante el SAT.</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>RFC del negocio</Label>
                  <Input value={settings?.rfc || ""} onChange={(e) => updateSettings("rfc", e.target.value.toUpperCase())} placeholder="XAXX010101000" />
                </div>
                <div>
                  <Label>Razón social</Label>
                  <Input value={settings?.business_name || ""} onChange={(e) => updateSettings("business_name", e.target.value)} />
                </div>
                <div>
                  <Label>Régimen fiscal</Label>
                  <Input placeholder="601 - General de Ley" disabled />
                </div>
                <div>
                  <Label>Código postal fiscal</Label>
                  <Input placeholder="Se habilitará en Fase 2" disabled />
                </div>
              </div>
            <div className="flex justify-end gap-3 mt-2">
              {rfcSaved && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDeleteRfc(true)}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar RFC
                  </Button>
                  <Button onClick={handleSaveSettings} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
                    <RefreshCw className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Actualizar RFC"}
                  </Button>
                </>
              )}
              {!rfcSaved && (
                <Button onClick={handleSaveSettings} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar RFC"}
                </Button>
              )}
            </div>

            {/* Confirm delete RFC */}
            {confirmDeleteRfc && (
              <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">¿Eliminar RFC?</p>
                      <p className="text-sm text-slate-500">Esta acción eliminará el RFC registrado del negocio.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setConfirmDeleteRfc(false)}>No</Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={async () => {
                        updateSettings("rfc", "");
                        setSaving(true);
                        if (settingsId) {
                          const response = await base44.functions.invoke('business', { action: 'updateAppSettingsSafe',
                            settings_id: settingsId,
                            updates: { ...settings, rfc: "" }
                          });
                          if (!response.data.success) {
                            toast.error(`Error: ${response.data.error || 'No se pudo eliminar RFC'}`);
                            setSaving(false);
                            return;
                          }
                        }
                        setSaving(false);
                        setRfcSaved(false);
                        setConfirmDeleteRfc(false);
                        toast.success("RFC eliminado");
                      }}
                    >
                      Sí, eliminar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </Card>
          </TabsContent>}

          {/* Team — Admin only */}
          {canTeam && <TabsContent value="team">
          <div className="space-y-4">
            {/* Invite code card */}
            <Card className="border-0 shadow-sm p-6 space-y-4">
              <h3 className="font-semibold text-slate-700 text-lg">Código de Invitación</h3>
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-5 space-y-3">
                <p className="text-sm text-slate-600">Comparte este código con tu equipo para que puedan unirse a tu negocio en StockFlow.</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white border border-brand-200 rounded-xl px-4 py-3 font-mono text-2xl tracking-widest text-brand-700 font-bold text-center">
                    {business?.invite_code || "—"}
                  </div>
                  <button type="button"
                    onClick={() => {
                      if (business?.invite_code) {
                        navigator.clipboard.writeText(business.invite_code);
                        toast.success("Código copiado");
                      }
                    }}
                    className="h-12 w-12 flex items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-colors flex-shrink-0"
                    title="Copiar código"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-400">Al registrarse, los usuarios seleccionan "Unirme a un equipo" e ingresan este código. Su solicitud queda pendiente: <strong>tú la apruebas</strong> y eliges su rol (abajo, en "Solicitudes para unirse").</p>
                <SeatLimitNotice />
                <div className="flex items-center justify-between pt-2 border-t border-brand-100">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={business?.invite_code_active !== false}
                      onCheckedChange={handleToggleInviteCode}
                    />
                    <span className="text-sm text-slate-600">
                      {business?.invite_code_active !== false ? "Código activo — acepta nuevos miembros" : "Código desactivado"}
                    </span>
                  </div>
                  <button type="button"
                    onClick={handleRotateInviteCode}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    title="Generar nuevo código (invalida el anterior)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Renovar
                  </button>
                </div>
              </div>
            </Card>

            {/* Pending join requests: approve (choosing the role) or reject */}
            <Card className="border-0 shadow-sm p-6">
              <JoinRequestsManager businessId={businessId} onApproved={() => setTeamRefresh((n) => n + 1)} />
            </Card>

            {/* Members list with role management */}
            <Card className="border-0 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-700 text-lg">Miembros del Equipo</h3>
                <p className="text-sm text-slate-500 mt-0.5">Gestiona los roles de los miembros de tu negocio. Los cambios aplican en su próximo inicio de sesión.</p>
              </div>
              <TeamMembersManager key={teamRefresh} businessId={businessId} currentUserId={currentUserId} />
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-700">Guía de roles</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <span className="font-semibold text-brand-700">Admin</span> — Acceso total: configura, crea, edita, elimina todo.
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <span className="font-semibold text-amber-700">Almacenista</span> — Productos, movimientos, cotizaciones y caja chica.
                  </div>
                </div>
              </div>
            </Card>
          </div>
          </TabsContent>}

          {/* Import — Admin only */}
          {canImport && <TabsContent value="import">
          <ImportProducts />
          </TabsContent>}

          {/* Account */}
          {canAccountTab && <TabsContent value="account">
          <div className="space-y-6">
            <LicenseInfoCard />
            <Card className="border-0 shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-slate-700 text-lg">Gestión de Cuenta</h3>
            {canExportData && (
              <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <Download className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Exportar mis datos</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Descarga un archivo JSON con todos los datos de tu negocio: productos, categorías, proveedores,
                      clientes, movimientos, cotizaciones, caja chica, utilidad y pagos a proveedores.
                      Hazlo <strong>antes</strong> de eliminar la cuenta.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  disabled={exporting}
                  {...createButtonProps("Exportar los datos del negocio en formato JSON")}
                >
                  {exporting
                    ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    : <Download className="h-4 w-4 mr-1" />}
                  {exporting ? "Exportando…" : "Exportar mis datos"}
                </Button>
              </div>
            )}
            {canDeleteAccount && <div className="border border-red-200 rounded-xl p-5 space-y-3 bg-red-50/50">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <UserX className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Eliminar mi cuenta</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Esta acción es <strong>permanente e irreversible</strong>. Se cerrará tu sesión y perderás acceso a StockFlow. Los datos del negocio no se eliminan automáticamente.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-100 hover:border-red-400 select-none"
                onClick={() => {
                  setConfirmDeleteAccount(true);
                  setConfirmDeleteStep(0);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar mi cuenta
              </Button>
            </div>}
          </Card>
            </div>
          </TabsContent>}

          {/* Audit Inventario */}
          {canAuditInventory && (
            <TabsContent value="inventario">
              <Card className="border-0 shadow-sm p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-700 text-lg">Audit Inventario</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Compara el stock actual de cada producto contra su historial de movimientos. Detecta ediciones directas, errores de sincronización y otras discrepancias, y permite al admin decidir cómo resolverlas.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      setAuditing(true);
                      setAuditResult(null);
                      try {
                        const resp = await base44.functions.invoke('products', { action: 'auditInventory' });
                        setAuditResult(resp.data);
                      } catch (e) {
                        toast.error(`Error al auditar: ${e.message}`);
                      } finally {
                        setAuditing(false);
                      }
                    }}
                    disabled={auditing}
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${auditing ? 'animate-spin' : ''}`} />
                    {auditing ? 'Auditando...' : 'Auditar inventario'}
                  </Button>
                </div>

                {auditResult && (() => {
                  const visible = (auditResult.discrepancies || []).filter(d => !dismissedIds.has(d.product_id));
                  const total = auditResult.summary?.products_audited ?? 0;

                  const reasonLabel = {
                    direct_edit: { label: 'Edición directa', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                    sync_error:  { label: 'Error de sync',   color: 'text-red-700 bg-red-50 border-red-200' },
                    no_movements:{ label: 'Sin movimientos', color: 'text-slate-700 bg-slate-50 border-slate-200' },
                    legacy_bug:  { label: 'Bug histórico',   color: 'text-purple-700 bg-purple-50 border-purple-200' },
                  };

                  return (
                    <div className="space-y-4">
                      {/* Summary bar */}
                      {visible.length === 0 ? (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                          <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-emerald-700 font-medium">
                              {(auditResult.discrepancies || []).length > 0
                                ? 'Todas las discrepancias han sido revisadas o corregidas.'
                                : `Inventario íntegro — ${total} producto${total !== 1 ? 's' : ''} auditado${total !== 1 ? 's' : ''}, sin discrepancias.`}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            <p className="text-sm text-amber-700 font-medium">
                              {visible.length} discrepancia{visible.length !== 1 ? 's' : ''} detectada{visible.length !== 1 ? 's' : ''} en {total} producto{total !== 1 ? 's' : ''} auditados.
                            </p>
                          </div>

                          <div className="rounded-xl border border-border overflow-hidden">
                            {visible.map((d) => {
                              const badge = reasonLabel[d.reason_type] || reasonLabel.sync_error;
                              const isInflated = d.difference > 0;
                              return (
                                <div key={d.product_id} className="border-b border-border last:border-0 px-4 py-4 hover:bg-muted/20 space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-slate-700 text-sm">{d.product}</p>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.color}`}>
                                          {badge.label}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{d.reason_detail}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                      <span className="text-sm text-red-500 font-bold line-through">{d.current_stock}</span>
                                      <span className="text-slate-400 text-xs">→</span>
                                      <span className="text-sm text-emerald-600 font-bold">{d.expected_stock}</span>
                                      <span className={`text-xs font-semibold ${isInflated ? 'text-red-500' : 'text-blue-500'}`}>
                                        ({isInflated ? '+' : ''}{d.difference})
                                      </span>
                                    </div>
                                  </div>

                                  {/* Audit log mini-history */}
                                  {d.audit_log_entries?.length > 0 && (
                                    <div className="flex items-start gap-1.5 text-xs text-slate-400 pl-1">
                                      <History className="h-3 w-3 mt-0.5 shrink-0" />
                                      <span>
                                        {d.audit_log_entries.length} edición{d.audit_log_entries.length !== 1 ? 'es' : ''} directa{d.audit_log_entries.length !== 1 ? 's' : ''} registrada{d.audit_log_entries.length !== 1 ? 's' : ''} —
                                        última por <strong>{d.audit_log_entries[d.audit_log_entries.length - 1].performed_by}</strong>
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex gap-2 justify-end pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-slate-200 text-slate-500 hover:text-slate-700"
                                      onClick={() => dismissProduct(d.product_id)}
                                    >
                                      <Minus className="h-3 w-3 mr-1" /> Ignorar
                                    </Button>
                                    {d.can_auto_correct && canCorrectInventory ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs border-slate-300 text-slate-600 hover:bg-slate-50"
                                          disabled={fixingProductId === d.product_id}
                                          onClick={() => { setCorrectionReason(""); setPendingCorrection({ d, mode: 'accept_current' }); }}
                                        >
                                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                          Aceptar actual ({d.current_stock})
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                                          disabled={fixingProductId === d.product_id}
                                          onClick={() => { setCorrectionReason(""); setPendingCorrection({ d, mode: 'revert_to_calculated' }); }}
                                        >
                                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                          Corregir a {d.expected_stock}
                                        </Button>
                                      </>
                                    ) : (
                                      <p className="text-xs text-slate-400 self-center">
                                        {d.can_auto_correct
                                          ? 'Solo el owner o un admin pueden corregir. '
                                          : 'Este caso no se corrige desde la auditoría. '}
                                        Usa <strong>Movimientos → Ajuste</strong> para corregir manualmente.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </Card>
            </TabsContent>
          )}

          {/* Referidos */}
          {canReferrals && (
            <TabsContent value="referidos">
              <ReferralPanel />
            </TabsContent>
          )}

          {/* Reglas del negocio */}
          {canRules && (
            <TabsContent value="reglas">
              <BusinessRulesPanel />
            </TabsContent>
          )}

          </Tabs>

          {/* Confirmación explícita de corrección de inventario */}
          <AlertDialog open={!!pendingCorrection} onOpenChange={(v) => { if (!v && !fixingProductId) setPendingCorrection(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingCorrection?.mode === 'accept_current' ? 'Aceptar el stock actual' : 'Corregir el stock'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingCorrection && (pendingCorrection.mode === 'accept_current'
                    ? `${pendingCorrection.d.product}: se aceptará el stock actual (${pendingCorrection.d.current_stock}) como correcto. El stock no cambia; la decisión queda registrada.`
                    : `${pendingCorrection.d.product}: el stock pasará de ${pendingCorrection.d.current_stock} a ${pendingCorrection.d.expected_stock} (calculado por el historial de movimientos).`)}
                  {' '}Se registrará quién lo hizo, cuándo, el valor antes y después y el motivo. Esta acción no se aplica automáticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2 space-y-1">
                <Label className="text-xs text-slate-500">Motivo (obligatorio)</Label>
                <Textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  maxLength={500}
                  placeholder="Ej. Conteo físico del 01/10 confirma el stock"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={!!fixingProductId}>Cancelar</AlertDialogCancel>
                <Button
                  disabled={!!fixingProductId || correctionReason.trim().length < 3}
                  onClick={applyCorrection}
                >
                  {fixingProductId ? 'Aplicando...' : 'Confirmar corrección'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Account Modal — Multi-step Flow */}
      {confirmDeleteAccount && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            {confirmDeleteStep === 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <UserX className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">¿Eliminar tu cuenta?</p>
                    <p className="text-sm text-slate-500">Esta acción no se puede deshacer.</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 space-y-1">
                  <p className="font-semibold mb-2">⚠️ Consecuencias de la eliminación:</p>
                  <p>• Se cerrará tu sesión de inmediato.</p>
                  <p>• No podrás volver a acceder con este usuario.</p>
                  <p>• Los datos del negocio permanecerán en el sistema.</p>
                  <p>• Tu email podrá ser utilizado para registrarse nuevamente.</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setConfirmDeleteAccount(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => setConfirmDeleteStep(1)}
                  >
                    Continuar
                  </Button>
                </div>
              </>
            )}
            {confirmDeleteStep === 1 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">⚠️ Última oportunidad</p>
                    <p className="text-sm text-slate-500">Asegúrate antes de continuar</p>
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2 text-sm">
                  <p className="font-semibold text-orange-900">Revisar antes de eliminar:</p>
                  <ul className="space-y-1.5 text-orange-800">
                    <li>✓ Descargaste o exportaste tus datos importantes</li>
                    <li>✓ Informaste a tu equipo sobre esta eliminación</li>
                    <li>✓ Entiendes que esto es permanente e irreversible</li>
                  </ul>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setConfirmDeleteStep(0)}>
                    Atrás
                  </Button>
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => setConfirmDeleteStep(2)}
                  >
                    Entiendo, eliminar
                  </Button>
                </div>
              </>
            )}
            {confirmDeleteStep === 2 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <UserX className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Confirmar eliminación final</p>
                    <p className="text-sm text-slate-500">Punto de no retorno</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">🚨 Operación irreversible</p>
                  <p className="text-sm text-red-700">
                    Tu cuenta será eliminada permanentemente junto con toda tu información personal. Los datos del negocio se mantendrán pero serán inaccesibles bajo este usuario.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setConfirmDeleteStep(0)} disabled={deletingAccount}>
                    Cancelar
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 select-none"
                    disabled={deletingAccount}
                    onClick={async () => {
                      setDeletingAccount(true);
                      try {
                        const me = await base44.auth.me();
                        await base44.entities.User.delete(me.id);
                      } catch {
                        // Silently proceed to logout even if deletion fails
                      }
                      base44.auth.logout();
                    }}
                  >
                    {deletingAccount ? "Eliminando cuenta..." : "Sí, eliminar cuenta permanentemente"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      </div>
      );
      }
// Shown next to the invite code once the plan's seats are used up: joining
// is blocked server-side (resolveJoinRequest → user_limit_reached), so the
// admin needs to know why a teammate can't get in and what to upgrade to.
function SeatLimitNotice() {
  const { activeUserCount, licensedUserLimit, licensePlan, isPlatformAdmin } = useLicense();
  if (isPlatformAdmin || activeUserCount == null || activeUserCount < licensedUserLimit) return null;
  const next = nextPlanFor(licensePlan);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      Tu plan incluye {licensedUserLimit} usuarios y ya los estás usando, así que no podrás aprobar más solicitudes de este código.
      {next && (
        <> Para agregar más, sube al plan <strong>{next.label}</strong>{" "}
          (<a href="https://www.acaciaco.com.mx/stockflow#planes" target="_blank" rel="noopener noreferrer" className="underline">ver planes</a>).
        </>
      )}
    </div>
  );
}
