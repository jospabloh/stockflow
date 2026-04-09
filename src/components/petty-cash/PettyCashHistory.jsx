import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MobileSelect } from "@/components/ui/MobileSelect";
import { Search, Download, Pencil, Trash2 } from "lucide-react";
import moment from "moment";

const TYPE_LABELS = {
  initial_fund: { label: "Fondo Inicial", color: "bg-blue-100 text-blue-700" },
  income:       { label: "Ingreso",       color: "bg-emerald-100 text-emerald-700" },
  expense:      { label: "Egreso",        color: "bg-rose-100 text-rose-700" },
  adjustment:   { label: "Ajuste",        color: "bg-amber-100 text-amber-700" },
};

export default function PettyCashHistory({ movements, isAdmin, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = !search ||
        m.description?.toLowerCase().includes(search.toLowerCase()) ||
        m.category?.toLowerCase().includes(search.toLowerCase()) ||
        m.reference?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || m.movement_type === typeFilter;
      const mDate = m.movement_date || m.created_date?.slice(0, 10);
      const matchFrom = !dateFrom || mDate >= dateFrom;
      const matchTo = !dateTo || mDate <= dateTo;
      return matchSearch && matchType && matchFrom && matchTo;
    });
  }, [movements, search, typeFilter, dateFrom, dateTo]);

  const handleExport = () => {
    const headers = ["Fecha", "Tipo", "Descripción", "Categoría", "Monto", "Referencia", "Notas"];
    const rows = filtered.map(m => [
      m.movement_date || moment.utc(m.created_date).local().format("YYYY-MM-DD"),
      TYPE_LABELS[m.movement_type]?.label || m.movement_type,
      m.description, m.category || "", m.amount, m.reference || "", m.notes || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "caja_chica.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar descripción, categoría..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <MobileSelect
          value={typeFilter}
          onValueChange={setTypeFilter}
          placeholder="Tipo"
          triggerClassName="w-36"
          options={[
            { value: "all", label: "Todos" },
            { value: "initial_fund", label: "Fondo Inicial" },
            { value: "income", label: "Ingresos" },
            { value: "expense", label: "Egresos" },
            { value: "adjustment", label: "Ajustes" },
          ]}
        />
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" title="Desde" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" title="Hasta" />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Referencia</TableHead>
                {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                    Sin movimientos en este período
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(m => {
                  const cfg = TYPE_LABELS[m.movement_type] || TYPE_LABELS.adjustment;
                  const isNeg = m.movement_type === "expense";
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                        {m.movement_date || moment.utc(m.created_date).local().format("DD/MM/YY")}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate" title={m.description}>
                        {m.description}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{m.category || "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${isNeg ? "text-rose-600" : "text-emerald-600"}`}>
                        {isNeg ? "−" : "+"} ${m.amount?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{m.reference || "—"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(m)} title="Editar">
                              <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(m.id)} title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}