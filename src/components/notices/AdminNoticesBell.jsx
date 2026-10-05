import React, { useCallback, useEffect, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Avisos para el administrador: borrados de proveedores, clientes o contactos hechos por un
// usuario que no es administrador. Elemento NO bloqueante (popover anclado al icono) y a prueba
// de fallos: si la carga falla (o la accion aun no existe en el backend) no se muestra toast ni
// se afecta al resto de la app; el icono se pinta sin contador. Solo se monta para owner/admin.

const REFRESH_MS = 5 * 60 * 1000;
const ENTITY_LABEL = { Supplier: "proveedor", Client: "cliente", Contact: "contacto" };
const HIDDEN_SNAPSHOT_KEYS = new Set(["id", "business_id", "created_by_id", "created_by", "created_date", "updated_date", "is_sample"]);

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
};

const formatValue = (v) => {
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "—";
    }
  }
  return String(v);
};

function NoticeItem({ notice, busy, onMarkRead }) {
  const who = notice.performed_by_name || notice.performed_by_email || "Un usuario";
  const kind = ENTITY_LABEL[notice.entity_type] || "registro";
  const snapshot =
    notice.record_snapshot && typeof notice.record_snapshot === "object" && !Array.isArray(notice.record_snapshot)
      ? Object.entries(notice.record_snapshot).filter(([k, v]) => !HIDDEN_SNAPSHOT_KEYS.has(k) && v !== null && v !== undefined && v !== "")
      : [];
  const isRead = notice.status === "read";

  return (
    <li className={`rounded-md border p-3 text-sm ${isRead ? "bg-slate-50 text-slate-500" : "bg-amber-50 border-amber-200"}`}>
      <p className="font-medium text-slate-800">
        {who} eliminó el {kind} «{notice.record_label || "sin nombre"}»
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{formatDate(notice.performed_at || notice.created_date)}</p>
      {snapshot.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-600">Ver datos del registro eliminado</summary>
          <dl className="mt-1 space-y-0.5">
            {snapshot.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-slate-500 shrink-0">{k}:</dt>
                <dd className="text-slate-700 break-words min-w-0">{formatValue(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <div className="mt-2">
        {isRead ? (
          <p className="text-xs">
            Leído por {notice.read_by_email || "un administrador"}
            {notice.read_at ? ` el ${formatDate(notice.read_at)}` : ""}
          </p>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onMarkRead(notice.id)}>
            Marcar como leído
          </Button>
        )}
      </div>
    </li>
  );
}

export default function AdminNoticesBell() {
  const [notices, setNotices] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(false);
  const [markError, setMarkError] = useState(false);
  const [showRead, setShowRead] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const mounted = useRef(true);
  const showReadRef = useRef(false);
  showReadRef.current = showRead;

  const load = useCallback(async (all) => {
    try {
      const res = await base44.functions.invoke("business", {
        action: "listAdminNotices",
        status: all ? "all" : "unread",
      });
      const data = res?.data ?? res;
      if (!mounted.current) return;
      if (!data || data.success !== true || !Array.isArray(data.notices)) throw new Error("bad response");
      // Los no leidos primero.
      const sorted = [...data.notices].sort((a, b) => (a.status === "unread" ? 0 : 1) - (b.status === "unread" ? 0 : 1));
      setNotices(sorted);
      setUnreadCount(Number(data.unread_count) || 0);
      setError(false);
    } catch {
      // Sin toast ni bloqueo: la app sigue igual.
      if (mounted.current) setError(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    const timer = setInterval(() => load(showReadRef.current), REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const toggleHistory = () => {
    const next = !showRead;
    setShowRead(next);
    load(next);
  };

  const markRead = async (id) => {
    setBusyId(id);
    setMarkError(false);
    try {
      const res = await base44.functions.invoke("business", { action: "markAdminNoticeReadSafe", notice_id: id });
      const data = res?.data ?? res;
      if (!data || data.success !== true) throw new Error("bad response");
      await load(showRead);
    } catch {
      if (mounted.current) setMarkError(true);
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const visible = showRead ? notices : notices.filter((n) => n.status === "unread");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={!error && unreadCount > 0 ? `${unreadCount} avisos sin leer` : "Avisos para el administrador"}
          title={error ? "No se pudieron cargar los avisos" : "Avisos para el administrador"}
        >
          <Inbox className="h-5 w-5 text-slate-500" aria-hidden="true" />
          {!error && unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
              aria-hidden="true"
            >
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-3">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Avisos para el administrador</h3>
        {error ? (
          <p className="text-sm text-slate-500">No se pudieron cargar los avisos. Intenta de nuevo más tarde.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-500">No hay avisos pendientes.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {visible.map((n) => (
              <NoticeItem key={n.id} notice={n} busy={busyId === n.id} onMarkRead={markRead} />
            ))}
          </ul>
        )}
        {markError && <p className="mt-2 text-xs text-red-600">No se pudo marcar como leído. Intenta de nuevo.</p>}
        {!error && (
          <button type="button" className="mt-3 text-xs text-slate-600 underline" onClick={toggleHistory}>
            {showRead ? "Ocultar leídos" : "Ver avisos leídos"}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
