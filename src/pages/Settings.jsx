import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Building2, Palette, Users, FileText, Plus, Trash2, Pencil, Upload } from "lucide-react";
import ImportProducts from "@/components/settings/ImportProducts";
import ClientsManager from "@/components/settings/ClientsManager";
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
  const [settings, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Category/Supplier form
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [supFormOpen, setSupFormOpen] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({ name: "", contact_name: "", email: "", phone: "" });

  useEffect(() => {
    Promise.all([
      base44.entities.AppSettings.list("-created_date", 1),
      base44.entities.Category.list(),
      base44.entities.Supplier.list(),
    ]).then(([sets, cats, sups]) => {
      if (sets.length > 0) {
        setSettings(sets[0]);
        setSettingsId(sets[0].id);
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
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    if (settingsId) {
      await base44.entities.AppSettings.update(settingsId, settings);
    } else {
      const created = await base44.entities.AppSettings.create(settings);
      setSettingsId(created.id);
    }
    setSaving(false);
    toast.success("Configuración guardada");
  };

  const handleSaveCategory = async () => {
    if (editingCat) {
      await base44.entities.Category.update(editingCat.id, catForm);
    } else {
      await base44.entities.Category.create(catForm);
    }
    const cats = await base44.entities.Category.list();
    setCategories(cats);
    setCatFormOpen(false);
    setEditingCat(null);
    setCatForm({ name: "", description: "", color: "#6366f1" });
  };

  const handleDeleteCategory = async (id) => {
    await base44.entities.Category.delete(id);
    setCategories(categories.filter((c) => c.id !== id));
  };

  const handleSaveSupplier = async () => {
    if (editingSup) {
      await base44.entities.Supplier.update(editingSup.id, supForm);
    } else {
      await base44.entities.Supplier.create(supForm);
    }
    const sups = await base44.entities.Supplier.list();
    setSuppliers(sups);
    setSupFormOpen(false);
    setEditingSup(null);
    setSupForm({ name: "", contact_name: "", email: "", phone: "" });
  };

  const handleDeleteSupplier = async (id) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-white shadow-sm border">
          <TabsTrigger value="business"><Building2 className="h-4 w-4 mr-1" /> Negocio</TabsTrigger>
          <TabsTrigger value="categories"><Palette className="h-4 w-4 mr-1" /> Categorías</TabsTrigger>
          <TabsTrigger value="suppliers"><Users className="h-4 w-4 mr-1" /> Proveedores</TabsTrigger>
          <TabsTrigger value="sat"><FileText className="h-4 w-4 mr-1" /> SAT 4.0</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" /> Clientes</TabsTrigger>
          <TabsTrigger value="import"><Upload className="h-4 w-4 mr-1" /> Importar</TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business">
          <Card className="border-0 shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-slate-700 text-lg">Información del Negocio</h3>
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

        {/* Import */}
        <TabsContent value="import">
          <ImportProducts />
        </TabsContent>

        {/* SAT 4.0 */}
        <TabsContent value="sat">
          <Card className="border-0 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-700 text-lg">Preparación SAT 4.0</h3>
            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">⚠ Módulo en preparación</p>
              <p>Este módulo está reservado para la integración de facturación electrónica (CFDI) conforme al SAT 4.0 de México. Puedes registrar tu RFC y datos fiscales para facilitar la futura integración.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>RFC del negocio</Label>
                <Input value={settings?.rfc || ""} onChange={(e) => updateSettings("rfc", e.target.value)} placeholder="XAXX010101000" />
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
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-1" /> Guardar RFC
              </Button>
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