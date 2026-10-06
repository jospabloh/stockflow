import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createButtonProps } from "@/lib/a11y";
import { toast } from "sonner";
import {
  PiggyBank, TrendingUp, TrendingDown, ListOrdered,
  Plus, Minus, SlidersHorizontal, History
} from "lucide-react";
import moment from "moment";
import PettyCashMovementForm from "@/components/petty-cash/PettyCashMovementForm";
import PettyCashHistory from "@/components/petty-cash/PettyCashHistory";
import { seedAndDedupeCatalog } from "@/lib/seedCatalog";
import { DEFAULT_RUBROS } from "@/lib/catalogDefaults";

export default function PettyCash() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState("income");
  const [editingMovement, setEditingMovement] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rubros, setRubros] = useState([]);

  const loadMovements = async () => {
    if (!businessId) return;
    const data = await base44.entities.PettyCashMovement.filter({ business_id: businessId }, "-movement_date", 500);
    setMovements(data);
    setLoading(false);
  };

  const loadRubros = async () => {
    if (!businessId) return;
    try {
      const data = await seedAndDedupeCatalog({
        entity: "Rubro",
        businessId,
        defaults: DEFAULT_RUBROS,
        keyOf: (r) => `${r.name}|${r.kind}`,
      });
      setRubros((data || []).filter((r) => r.active !== false));
    } catch (err) {
      console.error("Error loading rubros:", err);
    }
  };

  useEffect(() => {
    loadMovements();
    loadRubros();
  }, [businessId]);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const balance = useMemo(() =>
    movements.reduce((acc, m) => {
      if (m.movement_type === "expense") return acc - m.amount;
      return acc + m.amount;
    }, 0),
  [movements]);

  const now = moment();
  const monthStart = now.clone().startOf("month").format("YYYY-MM-DD");
  const monthEnd   = now.clone().endOf("month").format("YYYY-MM-DD");

  const { monthIncome, monthExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    movements.forEach(m => {
      const d = m.movement_date || "";
      if (d >= monthStart && d <= monthEnd) {
        if (m.movement_type === "expense") exp += m.amount;
        else inc += m.amount;
      }
    });
    return { monthIncome: inc, monthExpense: exp };
  }, [movements, monthStart, monthEnd]);

  const recent = useMemo(() => movements.slice(0, 5), [movements]);

  const hasInitialFund = movements.some(m => m.movement_type === "initial_fund");

  const openForm = (type) => { setEditingMovement(null); setFormType(type); setFormOpen(true); };
  const openEdit = (m) => {
    if (m?.generated_by_system) {
      toast.error("Este ingreso fue generado automáticamente por una venta y no puede editarse aquí. Corrígelo desde la cotización o movimiento de origen.");
      return;
    }
    setEditingMovement(m);
    setFormOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    const target = movements.find(m => m.id === deletingId);
    if (target?.generated_by_system) {
      toast.error("Este ingreso fue generado automáticamente por una venta. Para eliminarlo, cancela o revierte la venta original en Cotizaciones o Movimientos.");
      setDeletingId(null);
      return;
    }
    try {
      const resp = await base44.functions.invoke('pettyCash', { action: 'deletePettyCashMovementSafe', movement_id: deletingId });
      if (!resp?.data?.success) {
        toast.error(resp?.data?.error || "No se pudo eliminar el movimiento");
        return;
      }
      toast.success("Movimiento eliminado");
      setDeletingId(null);
      loadMovements();
    } catch (err) {
      console.error("Delete petty cash movement error:", err);
      toast.error("No se pudo eliminar el movimiento");
    }
  };

  if (!businessId) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <PiggyBank className="h-12 w-12 text-slate-300" />
      <p className="text-slate-500">No se encontró un negocio asociado a tu cuenta.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-brand-500" /> Caja Chica
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Control de dinero para gastos menores del negocio</p>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {!hasInitialFund && can('Caja Chica', 'add_fund') && (
            <Button onClick={() => openForm("initial_fund")} variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50" {...createButtonProps('add')}>
              <Plus className="h-4 w-4 mr-1" /> Fondo Inicial
            </Button>
          )}
          {can('Caja Chica', 'income') && (
          <Button onClick={() => openForm("income")} className="bg-emerald-600 hover:bg-emerald-700" {...createButtonProps('add')}>
            <Plus className="h-4 w-4 mr-1" /> Ingreso
          </Button>
          )}
          {can('Caja Chica', 'expense') && (
          <Button onClick={() => openForm("expense")} className="bg-rose-600 hover:bg-rose-700" {...createButtonProps('add')}>
            <Minus className="h-4 w-4 mr-1" /> Egreso
          </Button>
          )}
          {can('Caja Chica', 'edit_amount') && (
            <Button onClick={() => openForm("adjustment")} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" {...createButtonProps('add')}>
              <SlidersHorizontal className="h-4 w-4 mr-1" /> Ajuste
            </Button>
          )}
        </div>
      </div>

      {/* No initial fund warning */}
      {!hasInitialFund && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <PiggyBank className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">Caja chica sin fondo inicial</p>
            <p className="text-xs text-blue-600 mt-0.5">Registra el fondo inicial para comenzar a controlar tu caja chica.</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Balance */}
        <Card className="border-0 shadow-sm p-5 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-brand-100 text-sm font-medium">Saldo Actual</span>
            <PiggyBank className="h-5 w-5 text-brand-200" />
          </div>
          <p className={`text-3xl font-bold ${balance < 0 ? "text-rose-200" : "text-white"}`}>
            ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-brand-200 text-xs mt-1">{movements.length} movimiento(s) total</p>
        </Card>

        {/* Month income */}
        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Ingresos del mes</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            ${monthIncome.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-muted-foreground text-xs mt-1">{now.format("MMMM YYYY")}</p>
        </Card>

        {/* Month expense */}
        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Egresos del mes</span>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600">
            ${monthExpense.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-muted-foreground text-xs mt-1">{now.format("MMMM YYYY")}</p>
        </Card>
      </div>

      {/* Tabs: recent / history */}
      <Tabs defaultValue="recent">
        <TabsList className="bg-white shadow-sm border h-auto w-full sm:w-auto">
          <TabsTrigger value="recent" className="flex-1 whitespace-normal"><ListOrdered className="h-4 w-4 mr-1" /> Últimos movimientos</TabsTrigger>
          {can('Caja Chica', 'view_history') && (
          <TabsTrigger value="history" className="flex-1 whitespace-normal"><History className="h-4 w-4 mr-1" /> Historial completo</TabsTrigger>
          )}
        </TabsList>

        {/* Recent */}
        <TabsContent value="recent" className="space-y-2 mt-4">
          {recent.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Sin movimientos registrados</p>
            </div>
          ) : (
            recent.map(m => {
              const isNeg = m.movement_type === "expense";
              const typeColors = {
                initial_fund: "bg-blue-100 text-blue-700",
                income: "bg-emerald-100 text-emerald-700",
                expense: "bg-rose-100 text-rose-700",
                adjustment: "bg-amber-100 text-amber-700",
              };
              const typeLabels = {
                initial_fund: "Fondo Inicial",
                income: "Ingreso",
                expense: "Egreso",
                adjustment: "Ajuste",
              };
              const isSystemGenerated = m.generated_by_system === true;
              return (
                <div key={m.id} className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 ${isSystemGenerated ? "border-brand-200 dark:border-brand-800" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{m.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.movement_date || moment.utc(m.created_date).local().format("DD/MM/YY")}
                      {m.category ? ` · ${m.category}` : ""}
                      {isSystemGenerated && " · Generado por venta"}
                    </p>
                  </div>
                  <Badge className={`${typeColors[m.movement_type]} border-0 text-xs whitespace-nowrap`}>
                    {typeLabels[m.movement_type]}
                  </Badge>
                  <span className={`font-bold text-sm whitespace-nowrap ${isNeg ? "text-rose-600" : "text-emerald-600"}`}>
                    {isNeg ? "−" : "+"} ${m.amount?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                  {(can('Caja Chica', 'edit_amount') || can('Caja Chica', 'delete')) && (
                    <div className="flex gap-1 ml-1">
                      {isSystemGenerated ? (
                        <span className="text-[10px] text-slate-400 px-1" title="Generado automáticamente — editar desde la venta de origen">🔒</span>
                      ) : (
                        <>
                          {can('Caja Chica', 'edit_amount') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)} title="Editar">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.415.586H9v-2.414a2 2 0 01.586-1.414z" /></svg>
                          </Button>
                          )}
                          {can('Caja Chica', 'delete') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletingId(m.id)} title="Eliminar">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Full history */}
        {can('Caja Chica', 'view_history') && (
        <TabsContent value="history" className="mt-4">
          <PettyCashHistory
            movements={movements}
            canEdit={can('Caja Chica', 'edit_amount')}
            canDelete={can('Caja Chica', 'delete')}
            canExport={can('Caja Chica', 'export')}
            onEdit={openEdit}
            onDelete={setDeletingId}
          />
        </TabsContent>
        )}
      </Tabs>

      {/* Movement form modal */}
      {formOpen && (
        <PettyCashMovementForm
          open={formOpen}
          movementType={formType}
          businessId={businessId}
          currentBalance={balance}
          rubros={rubros}
          onSaved={loadMovements}
          onClose={() => { setFormOpen(false); setEditingMovement(null); }}
          movement={editingMovement}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El saldo de caja chica se recalculará automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-rose-600 hover:bg-rose-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}