import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Building2, Check, ChevronDown, Loader2, Plus } from "lucide-react";

// Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md). El nombre del
// negocio en la cabecera del sidebar, convertido en desplegable SOLO cuando
// hay más de una Membership propia — con una sola, sigue siendo texto plano:
// una flecha que abre un menú de un solo elemento es una promesa falsa sobre
// lo que la app puede hacer. Mismo patrón que el TenantSwitcher de CtrlHQ
// (jospabloh/ctrlhq), la implementación de referencia del estándar.
//
// Cambiar de negocio pasa por switchBusiness() -> switchBusinessSafe, que
// re-deriva la Membership en el servidor antes de mover business_id/role.
// Todo lo que hay aquí es una etiqueta; la autorización real vive en la
// función.
export default function BusinessSwitcher() {
  const { businessId, businessName, memberships, switchBusiness, switching } = useBusinessContext();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const ref = useRef(null);

  const others = (memberships || []).filter((m) => m.business_id !== businessId);
  const canSwitch = (memberships || []).length > 1;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !others.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        others.map(async (m) => {
          // Business.read RLS solo concede id == user.data.business_id — el
          // negocio activo. Una Membership a un negocio distinto del activo
          // no es legible por esta vía, así que esto degrada a un
          // marcador de posición en vez de fallar: el switcher sigue
          // funcionando, solo sin el nombre real hasta que se cambie a él.
          try {
            const b = await base44.entities.Business.get(m.business_id);
            return [m.business_id, b?.name || "Negocio sin nombre"];
          } catch {
            return [m.business_id, "Negocio sin nombre"];
          }
        })
      );
      if (!cancelled) setNames(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [open, memberships, businessId]);

  const go = async (targetBusinessId) => {
    setError("");
    setBusyId(targetBusinessId);
    try {
      await switchBusiness(targetBusinessId);
      // switchBusiness ya recarga la página al terminar — este catch solo
      // cubre el caso en que la propia función invoke falle antes de eso.
    } catch (err) {
      const serverMessage = err?.data?.message || err?.originalError?.response?.data?.error || err?.message;
      setError(serverMessage || "No pudimos cambiar de negocio.");
      setBusyId("");
    }
  };

  const label = businessName || "Control de stock";

  if (!canSwitch) {
    return (
      <p className="text-xs text-muted-foreground truncate">{label}</p>
    );
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-full flex items-center gap-1 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/60 transition-colors"
      >
        <span
          className="text-xs text-muted-foreground truncate"
          title={label}
        >
          {label}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-60 z-50 rounded-lg border border-border bg-card shadow-lg p-1"
        >
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Cambiar de negocio</p>
          {error && (
            <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
          )}
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-muted/50">
            <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span className="text-sm truncate">{label}</span>
          </div>
          {others.map((m) => (
            <button
              key={m.id || m.business_id}
              type="button"
              role="menuitem"
              disabled={!!busyId || switching}
              onClick={() => go(m.business_id)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/60 disabled:opacity-60 text-left transition-colors"
            >
              {busyId === m.business_id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              )}
              <span className="text-sm truncate">
                {names[m.business_id] || "Cargando…"}
              </span>
            </button>
          ))}
          <a
            href="/BusinessSetup"
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/60 text-left border-t border-border mt-1 pt-2"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-sm">Crear o unirme a otro</span>
          </a>
        </div>
      )}
    </div>
  );
}
