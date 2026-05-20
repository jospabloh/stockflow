import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Users, Gift, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const MILESTONE_TARGET = 3;
const MILESTONE_REWARD = "1 mes gratis";

export default function ReferralPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke("getReferralStats", {})
      .then((resp) => setStats(resp.data))
      .catch(() => toast.error("Error al cargar estadísticas de referidos"))
      .finally(() => setLoading(false));
  }, []);

  const shareLink = stats?.referral_code
    ? `${window.location.origin}/BusinessSetup?ref=${stats.referral_code}`
    : "";

  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast.success("Enlace copiado al portapapeles");
  };

  const handleWhatsApp = () => {
    if (!shareLink) return;
    const msg = encodeURIComponent(
      `¡Te invito a probar StockFlow, el sistema de inventario que uso en mi negocio! 🚀\n\nÚsalo gratis 45 días con mi código: *${stats.referral_code}*\n\n${shareLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm p-6 flex items-center justify-center h-40">
        <div className="h-7 w-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </Card>
    );
  }

  if (!stats) return null;

  const progress = Math.min(stats.total_referrals, MILESTONE_TARGET);
  const progressPct = Math.round((progress / MILESTONE_TARGET) * 100);

  return (
    <div className="space-y-4">
      {/* Code + share */}
      <Card className="border-0 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-700 text-lg">Programa de Referidos</h3>
        </div>
        <p className="text-sm text-slate-500">
          Invita a otros negocios a StockFlow. Cada vez que alguien se registre con tu enlace,{" "}
          <strong>ambos obtienen +15 días de prueba gratis</strong>.
        </p>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Tu código de referido</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-3 font-mono text-xl tracking-widest text-indigo-700 font-bold text-center">
              {stats.referral_code}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="h-12 w-12 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex-shrink-0"
              title="Copiar enlace"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>

          <Button
            onClick={handleWhatsApp}
            className="w-full bg-green-500 hover:bg-green-600 text-white gap-2"
          >
            <Share2 className="h-4 w-4" />
            Compartir por WhatsApp
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <Card className="border-0 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-700">Tus estadísticas</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.total_referrals}</p>
            <p className="text-xs text-slate-500 mt-1">Referidos</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.converted_referrals}</p>
            <p className="text-xs text-slate-500 mt-1">Convertidos</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">+{stats.bonus_days_earned}</p>
            <p className="text-xs text-slate-500 mt-1">Días ganados</p>
          </div>
        </div>

        {/* Milestone progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-400" />
              <p className="text-sm text-slate-600 font-medium">
                Meta: {MILESTONE_TARGET} referidos → {MILESTONE_REWARD}
              </p>
            </div>
            <span className="text-xs text-slate-400">{progress}/{MILESTONE_TARGET}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progress >= MILESTONE_TARGET && (
            <p className="text-sm text-emerald-600 font-medium text-center">
              🎉 ¡Meta alcanzada! Contacta a soporte para reclamar tu recompensa.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
