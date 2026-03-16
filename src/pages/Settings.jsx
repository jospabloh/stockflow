import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Building2, Palette, Users, FileText, Plus, Trash2, Pencil, Upload, AlertTriangle, RefreshCw, Copy, Key, UserX } from "lucide-react";
import ImportProducts from "@/components/settings/ImportProducts";
import ClientsManager from "@/components/settings/ClientsManager";
import { useBusinessContext } from "@/components/BusinessContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Settings() {
  const { businessId } = useBusinessContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [settings, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [business, setBusiness] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [rfcSaved, setRfcSaved] = useState(false);
  const [confirmDeleteRfc, setConfirmDeleteRfc] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Category/Supplier form
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [supFormOpen, setSupFormOpen] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({ name: "", contact_name: "", email: "", phone: "" });

  useEffect(() => {
    base44.auth.me().then(u => {
      setIsAdmin(u?.role === "admin");
      setCheckingAuth(false);
    }).catch(() => setCheckingAuth(false));
    Promise.all([
      base44.entities.AppSettings.list("-created_date", 1),
      base44.entities.Category.list(),
      base44.entities.Supplier.list(),
    ]).then(([sets, cats, sups]) => {
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
      setCategories(cats);
      setSuppliers(sups);
      setLoading(false);
    });
    // Load business entity for invite code
    if (businessId) {
      base44.entities.Business.filter({ id: businessId }).then(list => {
        if (list.length > 0) setBusiness(list[0]);
      }).catch(() => {});
    }
  }, []);

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
    if (settingsId) {
      await base44.entities.AppSettings.update(settingsId, settings);
    } else {
      const created = await base44.entities.AppSettings.create({ ...settings, business_id: businessId });
      setSettingsId(created.id);
    }
    setSaving(false);
    setRfcSaved(!!settings?.rfc);
    toast.success("Configuración guardada");
  };

  const handleSaveCategory = async () => {
    if (editingCat) {
      await base44.entities.Category.update(editingCat.id, catForm);
    } else {
      await base44.entities.Category.create({ ...catForm, business_id: businessId });
    }
    const cats = await base44.entities.Category.list();
    setCategories(cats);
    setCatFormOpen(false);
    setEditingCat(null);
    setCatForm({ name: "", description: "", color: "#6366f1" });
  };

  const handleDeleteCategory = async (id) => {
    const products = await base44.entities.Product.filter({ category: id });
    if (products.length > 0) {
      toast.error(`No se puede eliminar: ${products.length} producto(s) usan esta categoría.`);
      return;
    }
    await base44.entities.Category.delete(id);
    setCategories(categories.filter((c) => c.id !== id));
  };

  const handleSaveSupplier = async () => {
    if (editingSup) {
      await base44.entities.Supplier.update(editingSup.id, supForm);
    } else {
      await base44.entities.Supplier.create({ ...supForm, business_id: businessId });
    }
    const sups = await base44.entities.Supplier.list();
    setSuppliers(sups);
    setSupFormOpen(false);
    setEditingSup(null);
    setSupForm({ name: "", contact_name: "", email: "", phone: "" });
  };

  const handleDeleteSupplier = async (id) => {
    const products = await base44.entities.Product.filter({ supplier: id });
    if (products.length > 0) {
      toast.error(`No se puede eliminar: ${products.length} producto(s) tienen este proveedor asignado.`);
      return;
    }
    await base44.entities.Supplier.delete(id);
    setSuppliers(suppliers.filter((s) => s.id !== id));
  };

  const updateSettings = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));

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
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
          <Key className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-slate-600 font-medium">Acceso restringido</p>
        <p className="text-sm text-slate-400">Solo los administradores pueden acceder a la configuración.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="business"><Building2 className="h-4 w-4 mr-1" /> Negocio</TabsTrigger>
          <TabsTrigger value="categories"><Palette className="h-4 w-4 mr-1" /> Categorías</TabsTrigger>
          <TabsTrigger value="suppliers"><Users className="h-4 w-4 mr-1" /> Proveedores</TabsTrigger>
          <TabsTrigger value="sat"><FileText className="h-4 w-4 mr-1" /> Facturación</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" /> Clientes</TabsTrigger>
          <TabsTrigger value="team"><Key className="h-4 w-4 mr-1" /> Equipo</TabsTrigger>
          <TabsTrigger value="import"><Upload className="h-4 w-4 mr-1" /> Importar</TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business">
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
                  <span className="inline-flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors">
                    <Upload className="h-3 w-3" />
                    {uploadingLogo ? "Subiendo..." : "Subir logo"}
                  </span>
                </label>
                {settings?.logo_url && (
                  <button onClick={() => updateSettings("logo_url", "")} className="block text-xs text-red-400 hover:text-red-600">
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
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700 text-lg">Categorías</h3>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setEditingCat(null); setCatForm({ name: "", description: "", color: "#6366f1" }); setCatFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nueva
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell><div className="h-6 w-6 rounded-full" style={{ backgroundColor: cat.color || "#6366f1" }} /></TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-slate-500">{cat.description || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, description: cat.description || "", color: cat.color || "#6366f1" }); setCatFormOpen(true); }}>
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Suppliers */}
        <TabsContent value="suppliers">
          <Card className="border-0 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700 text-lg">Proveedores</h3>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setEditingSup(null); setSupForm({ name: "", contact_name: "", email: "", phone: "" }); setSupFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell className="font-medium">{sup.name}</TableCell>
                    <TableCell className="text-slate-500">{sup.contact_name || "—"}</TableCell>
                    <TableCell className="text-slate-500">{sup.email || "—"}</TableCell>
                    <TableCell className="text-slate-500">{sup.phone || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingSup(sup); setSupForm({ name: sup.name, contact_name: sup.contact_name || "", email: sup.email || "", phone: sup.phone || "" }); setSupFormOpen(true); }}>
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteSupplier(sup.id)}>
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Clients */}
        <TabsContent value="clients">
          <ClientsManager />
        </TabsContent>

        {/* Team / Invite Code */}
        <TabsContent value="team">
          <Card className="border-0 shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-slate-700 text-lg">Equipo y Acceso</h3>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-3">
              <p className="text-sm text-slate-600">Comparte este código con tu equipo para que puedan unirse a tu negocio en StockFlow.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-3 font-mono text-2xl tracking-widest text-indigo-700 font-bold text-center">
                  {business?.invite_code || "—"}
                </div>
                <button
                  onClick={() => {
                    if (business?.invite_code) {
                      navigator.clipboard.writeText(business.invite_code);
                      toast.success("Código copiado");
                    }
                  }}
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex-shrink-0"
                  title="Copiar código"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-slate-400">Al registrarse, los usuarios seleccionan "Unirme a un equipo" e ingresan este código.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-700">Guía de roles</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <span className="font-semibold text-indigo-700">admin</span> — Acceso total: configura, crea, edita, elimina todo.
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <span className="font-semibold text-cyan-700">vendedor</span> — Cotizaciones y clientes. Sin acceso a reportes financieros completos.
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <span className="font-semibold text-amber-700">almacenista</span> — Productos y movimientos de inventario.
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <span className="font-semibold text-slate-500">viewer</span> — Solo lectura. No puede crear ni modificar nada.
                </div>
              </div>
              <p className="text-xs text-slate-400 pt-1">Para cambiar el rol de un usuario, ve al Panel de Administración de la plataforma (Base44 dashboard → Users).</p>
            </div>
          </Card>
        </TabsContent>

        {/* Import */}
        <TabsContent value="import">
          <ImportProducts />
        </TabsContent>

        {/* Facturación */}
        <TabsContent value="sat">
          <Card className="border-0 shadow-sm overflow-hidden">
            {/* Under construction game section */}
            <div className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 flex flex-col items-center justify-center min-h-[360px] overflow-hidden">
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
              <p className="text-indigo-200 text-base text-center mb-1 font-medium">¡Estamos trabajando en algo genial!</p>
              <p className="text-indigo-300 text-sm text-center max-w-sm">
                El módulo de <strong className="text-white">Facturación Electrónica (CFDI 4.0)</strong> estará disponible muy pronto. Mientras tanto, puedes registrar tus datos fiscales abajo.
              </p>

              {/* Mini progress bar game */}
              <div className="mt-6 w-64">
                <div className="flex justify-between text-xs text-indigo-300 mb-1">
                  <span>Progreso de desarrollo</span>
                  <span>42%</span>
                </div>
                <div className="h-3 bg-indigo-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-full" style={{ width: "42%", animation: "progressFill 2s ease-out forwards" }} />
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
                  <Button onClick={handleSaveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                    <RefreshCw className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Actualizar RFC"}
                  </Button>
                </>
              )}
              {!rfcSaved && (
                <Button onClick={handleSaveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
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
                          await base44.entities.AppSettings.update(settingsId, { ...settings, rfc: "" });
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
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={catFormOpen} onOpenChange={setCatFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="w-14 h-10 p-1" />
                <Input value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCatFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveCategory} disabled={!catForm.name} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={supFormOpen} onOpenChange={setSupFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSup ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Contacto</Label>
              <Input value={supForm.contact_name} onChange={(e) => setSupForm({ ...supForm, contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSupFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSupplier} disabled={!supForm.name} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}