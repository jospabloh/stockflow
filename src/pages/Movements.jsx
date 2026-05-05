import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
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
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import moment from "moment";
import MovementEditDialog from "@/components/movements/MovementEditDialog";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { toast } from "sonner";

const typeConfig = {
  entry: { label: "Entrada", icon: ArrowDownLeft, color: "bg-emerald-100 text-emerald-700" },
  exit: { label: "Salida", icon: ArrowUpRight, color: "bg-rose-100 text-rose-700" },
  return: { label: "Devolución", icon: RotateCcw, color: "bg-amber-100 text-amber-700" },
  adjustment: { label: "Ajuste", icon: SlidersHorizontal, color: "bg-blue-100 text-blue-700" },
};

export default function Movements() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canCreateMovement, setCanCreateMovement] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [businessId, setBusinessId] = useState(null);
  const [deletingMovement, setDeletingMovement] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(null);
  const [productIdFilter, setProductIdFilter] = useState(null);

  const loadData = async (bId) => {
    if (!bId) return;
    Promise.all([
      base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
      base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
    ]).then(([movs, prods]) => {
      setMovements(movs);
      setProducts(prods);
      setLoading(false);
    });
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      const role = u?.role;
      setIsAdmin(role === "admin");
      // Admins AND almacenistas can create inventory movements
      setCanCreateMovement(role === "admin" || role === "almacenista" || role === "user");
      setBusinessId(u?.business_id || null);
      loadData(u?.business_id || null);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    if (type && ["entry", "exit", "return", "adjustment"].includes(type)) {
      setTypeFilter(type);
    }
    const pid = params.get("product_id");
    if (pid) {
      setProductIdFilter(pid);
    } else {
      setProductIdFilter(null);
    }
  }, [location.search]);

  const getFinalTotal = (m) => {
    // El precio unitario YA incluye IVA, así que el total es directamente quantity × unit_price
    return m.quantity * (m.unit_price || 0);
  };

  const filtered = movements.filter((m) => {
    const s = search.toLowerCase();
    const matchSearch = m.product_name?.toLowerCase().includes(s) ||
      m.reference?.toLowerCase().includes(s) ||
      m.reason?.toLowerCase().includes(s);
    const matchType = typeFilter === "all" || m.type === typeFilter;
    const matchProduct = !productIdFilter || m.product_id === productIdFilter;
    return matchSearch && matchType && matchProduct;
  });

  const filteredProductName = productIdFilter
    ? (products.find(p => p.id === productIdFilter)?.name || productIdFilter)
    : null;

  const handleDeleteMovement = async () => {
    if (!deletingMovement) return;
    setDeleteLoading(true);
    try {
      const res = await base44.functions.invoke('deleteMovementSafe', { movement_id: deletingMovement.id });
      if (!res.data?.success) {
        toast.error(`Error: ${res.data?.error || "No se pudo eliminar"}`);
        return;
      }
      toast.success("Movimiento eliminado y stock revertido");
      setDeletingMovement(null);
      loadData(businessId);
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmingPayment) return;
    try {
      const res = await base44.functions.invoke('confirmMovementPaymentSafe', {
        movement_id: confirmingPayment.id,
        business_id: businessId,
      });
      if (!res.data?.success) {
        toast.error(`Error: ${res.data?.error || 'No se pudo confirmar el pago'}`);
        return;
      }
      toast.success("Pago confirmado");
      setConfirmingPayment(null);
      loadData(businessId);
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    }
  };

  const handleExportCSV = () => {
     // Helper para escapar valores CSV
     const escapeCSV = (value) => {
       const str = String(value || "");
       if (str.includes(",") || str.includes('"') || str.includes("\n")) {
         return `"${str.replace(/"/g, '""')}"`;
       }
       return str;
     };

     const headers = ["Fecha", "Producto", "Tipo", "Cantidad", "Precio Unit.", "Total", "Forma de Pago", "Cliente"];
     const rows = filtered.map((m) => [
       moment.utc(m.data?.created_date || m.created_date).local().format("DD/MM/YYYY HH:mm"),
       m.product_name, typeConfig[m.type]?.label || m.type,
       m.quantity, m.unit_price || 0, getFinalTotal(m),
       m.reference || "", m.reason || "",
     ]);

     // Escapar todos los valores
     const escapedRows = rows.map((r) => r.map(escapeCSV).join(","));
     const csv = [headers.map(escapeCSV).join(","), ...escapedRows].join("\n");

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

  // Salidas directas sin pagar (no vinculadas a cotización)
  const unpaidDirectExits = movements.filter(m => m.type === "exit" && !m.quotation_id && !m.paid);
  const unpaidDirectTotal = unpaidDirectExits.reduce((sum, m) => sum + getFinalTotal(m), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Banner de filtro por producto (solo admin) */}
      {isAdmin && filteredProductName && (
        <div className="flex items-center justify-between gap-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-indigo-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                Historial de: <span className="font-bold">{filteredProductName}</span>
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">Mostrando solo movimientos de este producto</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/Movements")}>
            Ver todos
          </Button>
        </div>
      )}

      {/* Alerta de cobro pendiente */}
      {unpaidDirectExits.length > 0 && (
        <div className="flex items-center justify-between gap-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                {unpaidDirectExits.length} {unpaidDirectExits.length === 1 ? "salida directa sin cobrar" : "salidas directas sin cobrar"}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">Filtra por "Salidas" para gestionarlas</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-orange-600 dark:text-orange-400">Pendiente</p>
            <p className="font-bold text-orange-700 dark:text-orange-300">${unpaidDirectTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

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
          {can('Movements', 'create') && (
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
              <TableHead className="font-semibold text-muted-foreground" role="columnheader">Forma de Pago</TableHead>
              <TableHead className="font-semibold text-muted-foreground" role="columnheader">Cliente</TableHead>
              <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Stock Después</TableHead>
              <TableHead className="font-semibold text-muted-foreground text-center" role="columnheader">Pago</TableHead>
              {isAdmin && <TableHead className="font-semibold text-muted-foreground text-center" role="columnheader" colSpan={2}>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-slate-400">
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
                        {moment.utc(m.data?.created_date || m.created_date).local().format("DD/MM/YY HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{m.product_name}</TableCell>
                      <TableCell>
                        <Badge className={`${config.color} border-0 gap-1`}>
                          <IconComp className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={
                          m.type === "exit" ? "text-rose-600" :
                          m.type === "adjustment" ? "text-blue-600" :
                          "text-emerald-600"
                        }>
                          {m.type === "exit" ? "-" : m.type === "adjustment" ? "=" : "+"}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800">
                        {m.unit_price === 0 && m.type === "exit" ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
                            Muestra / Interno
                          </span>
                        ) : (
                          `$${getFinalTotal(m).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{m.type === "adjustment" ? <span className="text-blue-500 text-xs font-medium">Ajuste admin</span> : (m.reference || "—")}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{m.type === "adjustment" ? <span className="text-muted-foreground text-xs">Stock = {m.stock_after}</span> : (m.reason || "—")}</TableCell>
                      <TableCell className="text-right text-slate-600">{m.stock_after ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {m.type === "exit" && !m.quotation_id ? (
                          m.paid ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                              <CheckCircle2 className="h-3 w-3" /> Cobrado
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmingPayment(m)}
                              className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium hover:bg-orange-200 transition-colors"
                            >
                              <Clock className="h-3 w-3" /> Pendiente
                            </button>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                              onClick={(e) => { e.stopPropagation(); setEditingMovement(m); }}
                              aria-label="Editar movimiento"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                              onClick={(e) => { e.stopPropagation(); setDeletingMovement(m); }}
                              aria-label="Eliminar movimiento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </>
                      )}
                      </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <MovementEditDialog
        open={!!editingMovement}
        onOpenChange={(o) => !o && setEditingMovement(null)}
        movement={editingMovement}
        onSaved={() => loadData(businessId)}
      />

      {/* Confirmar pago */}
      <AlertDialog open={!!confirmingPayment} onOpenChange={(o) => !o && setConfirmingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar pago recibido?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás marcando como cobrado el movimiento de <strong>{confirmingPayment?.product_name}</strong> por{" "}
              <strong>${(confirmingPayment ? getFinalTotal(confirmingPayment) : 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>{" "}
              del cliente <strong>{confirmingPayment?.reason || "—"}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Sí, marcar como cobrado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingMovement} onOpenChange={(o) => !o && setDeletingMovement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el movimiento de <strong>{deletingMovement?.product_name}</strong> ({typeConfig[deletingMovement?.type]?.label}, {deletingMovement?.quantity} uds.) y el stock del producto será revertido automáticamente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMovement}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? "Eliminando..." : "Sí, eliminar y revertir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}