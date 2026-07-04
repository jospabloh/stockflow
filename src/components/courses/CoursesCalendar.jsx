import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, User, Clock } from "lucide-react";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function fmtLongDate(dstr) {
  const dt = new Date(`${dstr}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? dstr : dt.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

export default function CoursesCalendar() {
  const { businessId } = useBusinessContext();
  const [courses, setCourses] = useState([]);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(null); // 'YYYY-MM-DD'

  useEffect(() => {
    if (!businessId) { setCourses([]); return; }
    base44.entities.Course.filter({ business_id: businessId }, "-created_date", 500).then(setCourses).catch(() => setCourses([]));
  }, [businessId]);

  // Map date string -> [{course, session}]
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const c of courses) {
      if (c.status === "cancelled") continue;
      for (const s of (c.sessions || [])) {
        if (!s?.date) continue;
        (map[s.date] = map[s.date] || []).push({ course: c, session: s });
      }
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.session.start_time || "").localeCompare(b.session.start_time || ""));
    }
    return map;
  }, [courses]);

  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());

  // Build the month grid (weeks starting Monday)
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startOffset = (first.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const move = (delta) => {
    setSelected(null);
    setCursor(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  };
  const goToday = () => { setCursor({ y: now.getFullYear(), m: now.getMonth() }); setSelected(todayKey); };

  const selectedEvents = selected ? (eventsByDate[selected] || []) : [];

  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700 text-lg flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Calendario de cursos</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Hoy</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <p className="text-center font-medium text-slate-600 mb-3 capitalize">{MONTHS[cursor.m]} {cursor.y}</p>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
        {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-[76px] rounded-lg" />;
          const k = keyOf(cursor.y, cursor.m, d);
          const evts = eventsByDate[k] || [];
          const isToday = k === todayKey;
          const isSel = k === selected;
          return (
            <button
              type="button"
              key={i}
              onClick={() => setSelected(isSel ? null : k)}
              className={`min-h-[76px] rounded-lg border p-1 text-left align-top transition-colors
                ${isSel ? "border-brand-500 bg-brand-500/10" : "border-border hover:bg-muted/50"}`}
            >
              <div className={`text-xs font-medium mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full ${isToday ? "bg-brand-600 text-white" : "text-slate-500"}`}>{d}</div>
              <div className="space-y-0.5">
                {evts.slice(0, 2).map((e, idx) => (
                  <div key={idx} className="truncate rounded bg-brand-500/15 px-1 py-0.5 text-[10px] text-brand-700 dark:text-brand-300" title={e.course.title}>
                    {e.session.start_time ? `${e.session.start_time} ` : ""}{e.course.title}
                  </div>
                ))}
                {evts.length > 2 && <div className="text-[10px] text-muted-foreground px-1">+{evts.length - 2} más</div>}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-medium text-slate-700 capitalize mb-2">{fmtLongDate(selected)}</p>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sesiones este día.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((e, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.course.title}</span>
                    {(e.session.start_time || e.session.end_time) && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />{e.session.start_time}{e.session.end_time ? ` – ${e.session.end_time}` : ""}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {e.session.note && <Badge variant="secondary" className="text-[10px]">{e.session.note}</Badge>}
                    {e.course.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.course.location}</span>}
                    {e.course.instructor_name && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{e.course.instructor_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
