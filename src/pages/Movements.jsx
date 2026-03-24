import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import {
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
  Download,
} from "lucide-react";
import moment from "moment";
import MovementFormDialog from "@/components/movements/MovementFormDialog";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { createButtonProps } from "@/lib/a11y";

const typeConfig = {
  entry: { label: "Entrada", icon: ArrowDownLeft, color: "bg-emerald-100 text-emerald-700" },
  exit: { label: "Salida", icon: ArrowUpRight, color: "bg-rose-100 text-rose-700" },
  return: { label: "Devolución", icon: RotateCcw, color: "bg-amber-100 text-amber-700" },
  adjustment: { label: "Ajuste", icon: SlidersHorizontal, color: "bg-blue-100 text-blue-700" },
};

export default function Movements() {
  const navigate = useNavigate();
  const location = useLocation();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadData = () => {
    base44.entities.Movement.list("-created_date", 200).then((movs) => {
      setMovements(movs);
      setLoading(false);
    });
  };

  const handleSaved = (payload) => {
    if (!payload || payload._reconcile) {
      loadData();
    }
    // optimistic: movement list will reflect after reconcile
  };

  useEffect(() => {
    base44.auth.me().then(u => setIsAdmin(u?.role === "admin")).catch(() => {});
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    if (type && ["entry", "exit", "return", "adjustment"].includes(type)) {
      setTypeFilter(type);
    }
  }, [location.search]);

  const filtered = movements.filter((m) => {
    const matchSearch = m.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.reference?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || m.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleExportCSV = () => {
    const headers = ["Fecha", "Producto", "Tipo", "Cantidad", "Precio Unit.", "Total", "Referencia"];
    const rows = filtered.map((m) => [
      moment.utc(m.created_date).local().format("DD/MM/YYYY HH:mm"),
      m.product_name, typeConfig[m.type]?.label || m.type,
      m.quantity, m.unit_price || 0, m.total || 0, m.reference || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "movimientos.csv";
    a.click();
  };

  if (loading) {
    return <TableSkeleton rows={8} columns={7} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por producto o referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Buscar movimientos por nombre de producto o referencia"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <SelectWrapper
            value={typeFilter}
            onValueChange={setTypeFilter}
            placeholder="Tipo"
            ariaLabel="Filtrar por tipo de movimiento"
            options={[
              { value: "all", label: "Todos" },
              { value: "entry", label: "Entradas" },
              { value: "exit", label: "Salidas" },
              { value: "return", label: "Devoluciones" },
              { value: "adjustment", label: "Ajustes" },
            ]}
          />
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          {isAdmin && (
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/Movements/new")}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Movimiento
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table role="table" aria-label="Historial de movimientos de inventario">
            <TableHeader>
              <TableRow className="bg-muted/40" role="row">
              <TableHead className="font-semibold text-muted-foreground" role="columnheader">Fecha</TableHead>
              <TableHead className="font-semibold text-muted-foreground" role="columnheader">Producto</TableHead>
              <TableHead className="font-semibold text-muted-foreground" role="columnheader">Tipo</TableHead>
              <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Cantidad</TableHead>
              <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Total</TableHead>
              <TableHead className="font-semibold text-muted-foreground" role="columnheader">Referencia / Motivo</TableHead>
              <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Stock Después</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    Sin movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                 const config = typeConfig[m.type] || typeConfig.adjustment;
                 const IconComp = config.icon;
                 return (
                   <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors" role="row" aria-label={`${config.label} de ${m.product_name}, cantidad ${m.quantity}`}>
                      <TableCell className="text-slate-600 text-sm">
                        {moment.utc(m.created_date).local().format("DD/MM/YY HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{m.product_name}</TableCell>
                      <TableCell>
                        <Badge className={`${config.color} border-0 gap-1`}>
                          <IconComp className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={m.type === "exit" ? "text-rose-600" : "text-emerald-600"}>
                          {m.type === "exit" ? "-" : "+"}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-slate-700">
                        ${m.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "0.00"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        <div>{m.reference || "—"}</div>
                        {m.reason && <div className="text-xs text-slate-400 mt-0.5">{m.reason}</div>}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">{m.stock_after ?? "—"}</TableCell>
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