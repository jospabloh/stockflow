import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Users, Rocket, X, Copy, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";

const STORAGE_KEY = "onboarding_v1_done";

const steps = [
  { id: 1, icon: Rocket, label: "Bienvenido" },
  { id: 2, icon: Package, label: "Primer producto" },
  { id: 3, icon: Users, label: "Tu equipo" },
];

export default function OnboardingWizard({ inviteCode, onClose }) {
  const { businessId } = useBusinessContext();
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState({ name: "", price: "", stock: "" });
  const [saving, setSaving] = useState(false);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onClose();
  };

  const handleSaveProduct = async () => {
    if (!product.name.trim()) { setStep(3); return; }
    setSaving(true);
    try {
      await base44.functions.invoke("createProductSafe", {
        name: product.name.trim(),
        price: parseFloat(product.price) || 0,
        stock: parseInt(product.stock) || 0,
        business_id: businessId,
      });
      toast.success(`"${product.name}" agregado correctamente`);
    } catch {
      toast.error("No se pudo guardar el producto, pero puedes agregarlo después");
    } finally {
      setSaving(false);
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Progress header */}
        <div className="bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white text-sm font-medium opacity-80">Paso {step} de 3</p>
            <button type="button" onClick={finish} className="text-white/60 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-2">
            {steps.map((s) => (
              <div
                key={s.id}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s.id <= step ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="text-5xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-slate-800">¡Bienvenido a StockFlow!</h2>
                <p className="text-slate-500 text-sm">En menos de 2 minutos tendrás tu negocio listo.</p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: "📦", text: "Controla tu inventario en tiempo real" },
                  { icon: "📋", text: "Genera cotizaciones profesionales al instante" },
                  { icon: "💰", text: "Registra ventas y pagos sin complicaciones" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3 bg-indigo-50 rounded-xl p-3">
                    <span className="text-2xl">{icon}</span>
                    <p className="text-sm text-slate-700 font-medium">{text}</p>
                  </div>
                ))}
              </div>
              <Button onClick={() => setStep(2)} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
                Comenzar <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: First product */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-800">Agrega tu primer producto</h2>
                <p className="text-sm text-slate-500">Puedes agregar más después desde el catálogo.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Nombre del producto <span className="text-red-500">*</span></Label>
                  <Input
                    autoFocus
                    value={product.name}
                    onChange={(e) => setProduct({ ...product, name: e.target.value })}
                    placeholder="Ej: Camiseta talla M"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Precio de venta</Label>
                    <Input
                      type="number"
                      value={product.price}
                      onChange={(e) => setProduct({ ...product, price: e.target.value })}
                      placeholder="0.00"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label>Stock inicial</Label>
                    <Input
                      type="number"
                      value={product.stock}
                      onChange={(e) => setProduct({ ...product, stock: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                  Omitir
                </Button>
                <Button
                  onClick={handleSaveProduct}
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  {saving ? "Guardando..." : <>Guardar <ChevronRight className="h-4 w-4" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Team invite */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-800">Invita a tu equipo</h2>
                <p className="text-sm text-slate-500">Comparte este código para que se unan a tu negocio.</p>
              </div>
              {inviteCode ? (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Código de invitación</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-3 font-mono text-xl tracking-widest text-indigo-700 font-bold text-center">
                      {inviteCode}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode);
                        toast.success("Código copiado");
                      }}
                      className="h-12 w-12 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex-shrink-0"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-green-300 text-green-700 hover:bg-green-50 gap-2"
                    onClick={() => {
                      const msg = encodeURIComponent(
                        `Únete a mi equipo en StockFlow con el código: *${inviteCode}*\n\nDescarga la app y selecciona "Unirme a un equipo".`
                      );
                      window.open(`https://wa.me/?text=${msg}`, "_blank");
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Invitar por WhatsApp
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
                  Puedes ver y compartir el código de invitación desde <strong>Configuración → Equipo</strong>.
                </p>
              )}
              <Button onClick={finish} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
                Ir al Dashboard <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
