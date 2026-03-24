import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PiggyBank, TrendingUp, TrendingDown, ListOrdered,
  Plus, Minus, SlidersHorizontal, History
} from "lucide-react";
import moment from "moment";
import PettyCashMovementForm from "@/components/petty-cash/PettyCashMovementForm";
import PettyCashHistory from "@/components/petty-cash/PettyCashHistory";

export default function PettyCash() {
  const { businessId } = useBusinessContext();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState("income");

  const loadMovements = async () => {
    if (!businessId) return;
    const data = await base44.entities.PettyCashMovement.list("-movement_date", 500);
    setMovements(data);
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(u => setIsAdmin(u?.role === "admin")).catch(() => {});
    loadMovements();
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

  const openForm = (type) => { setFormType(type); setFormOpen(true); };

  if (!businessId) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <PiggyBank className="h-12 w-12 text-slate-300" />
      <p className="text-slate-500">No se encontró un negocio asociado a tu cuenta.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-indigo-500" /> Caja Chica
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Control de dinero para gastos menores del negocio</p>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {!hasInitialFund && (
            <Button onClick={() => openForm("initial_fund")} variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
              <Plus className="h-4 w-4 mr-1" /> Fondo Inicial
            </Button>
          )}
          <Button onClick={() => openForm("income")} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" /> Ingreso
          </Button>
          <Button onClick={() => openForm("expense")} className="bg-rose-600 hover:bg-rose-700">
            <Minus className="h-4 w-4 mr-1" /> Egreso
          </Button>
          {isAdmin && (
            <Button onClick={() => openForm("adjustment")} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
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
        <Card className="border-0 shadow-sm p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-indigo-100 text-sm font-medium">Saldo Actual</span>
            <PiggyBank className="h-5 w-5 text-indigo-200" />
          </div>
          <p className={`text-3xl font-bold ${balance < 0 ? "text-rose-200" : "text-white"}`}>
            ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-indigo-200 text-xs mt-1">{movements.length} movimiento(s) total</p>
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
        <TabsList className="bg-white shadow-sm border">
          <TabsTrigger value="recent"><ListOrdered className="h-4 w-4 mr-1" /> Últimos movimientos</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Historial completo</TabsTrigger>
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
              return (
                <div key={m.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{m.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.movement_date || moment.utc(m.created_date).local().format("DD/MM/YY")}
                      {m.category ? ` · ${m.category}` : ""}
                    </p>
                  </div>
                  <Badge className={`${typeColors[m.movement_type]} border-0 text-xs whitespace-nowrap`}>
                    {typeLabels[m.movement_type]}
                  </Badge>
                  <span className={`font-bold text-sm whitespace-nowrap ${isNeg ? "text-rose-600" : "text-emerald-600"}`}>
                    {isNeg ? "−" : "+"} ${m.amount?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Full history */}
        <TabsContent value="history" className="mt-4">
          <PettyCashHistory movements={movements} />
        </TabsContent>
      </Tabs>

      {/* Movement form modal */}
      {formOpen && (
        <PettyCashMovementForm
          open={formOpen}
          movementType={formType}
          businessId={businessId}
          currentBalance={balance}
          onSaved={loadMovements}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}