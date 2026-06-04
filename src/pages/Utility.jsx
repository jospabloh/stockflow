import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileSelect } from "@/components/ui/MobileSelect";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createButtonProps } from "@/lib/a11y";
import { toast } from "sonner";
import { Wallet, TrendingUp, Plus, Minus, Scale, Pencil, Trash2, Lock, Clock, LineChart, Sparkles } from "lucide-react";
import moment from "moment";
import UtilityMovementForm from "@/components/utility/UtilityMovementForm";
import { Switch } from "@/components/ui/switch";
import { computeSalesData } from "@/lib/finance/profitEngine";
import { getDateStringMexico } from "@/lib/finance/period";
import { isOperatingMovement } from "@/lib/finance/rubroTreatment";
import { computeConversionRate, getActiveQuotations, computeForecast } from "@/lib/finance/forecast";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (n) => `$${(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

// Renglón del Estado de Resultados (cascada)
function Row({ label, value, sign, bold, muted, highlight }) {
  const negativeResult = (bold || highlight) && value < 0;
  return (
    <div className={`flex items-center justify-between ${highlight ? "rounded-lg px-3 py-2 " + (negativeResult ? "bg-rose-50 dark:bg-rose-950/40" : "bg-emerald-50 dark:bg-emerald-950/40") : ""}`}>
      <span className={`${bold ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-400"}`}>{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${muted ? "text-rose-600" : negativeResult ? "text-rose-600" : bold ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}>
        {sign ? `${sign} ` : ""}{fmt(value)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-slate-200 dark:border-slate-700 my-1" />;
}

export default function Utility() {
  const { businessId } = useBusinessContext();
  const [movements, setMovements] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [accounts, setAccounts] = useState([]);
  // Datos operativos para el Estado de Resultados real (no la libreta manual)
  const [quotations, setQuotations] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [forecastEnabled, setForecastEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState("income");
  const [editingMovement, setEditingMovement] = useState(null);
  const [deletingMovement, setDeletingMovement] = useState(null);

  const now = moment();
  const [month, setMonth] = useState(now.month()); // 0-11
  const [year, setYear] = useState(now.year());

  // Filtros de historial
  const [filterType, setFilterType] = useState("all");
  const [filterRubro, setFilterRubro] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");

  const load = async () => {
    if (!businessId) return;
    try {
      const [movs, rbs, accs, quots, stockMovs, prods, pays, appSettingsList] = await Promise.all([
        base44.entities.UtilityMovement.filter({ business_id: businessId }, "-movement_date", 500),
        base44.entities.Rubro.filter({ business_id: businessId, active: true }),
        base44.entities.FundAccount.filter({ business_id: businessId, active: true }),
        base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 1000).catch(() => []),
        base44.entities.Movement.filter({ business_id: businessId }, "-created_date", 1000).catch(() => []),
        base44.entities.Product.filter({ business_id: businessId }, "-created_date", 500).catch(() => []),
        base44.entities.SupplierPayment.filter({ business_id: businessId }, "-payment_date", 1000).catch(() => []),
        base44.entities.AppSettings.filter({ business_id: businessId }).catch(() => []),
      ]);
      setMovements(movs || []);
      setRubros(rbs || []);
      setAccounts(accs || []);
      setQuotations(quots || []);
      setStockMovements(stockMovs || []);
      setProducts(prods || []);
      setSupplierPayments(pays || []);
      const settings = (appSettingsList || [])[0] || null;
      setAppSettings(settings);
      setForecastEnabled(settings?.utility_forecast_enabled === true);
    } catch (err) {
      console.error("Error loading utility movements:", err);
      toast.error("No se pudieron cargar los movimientos de utilidad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const monthStart = moment({ year, month, day: 1 }).format("YYYY-MM-DD");
  const monthEnd = moment({ year, month, day: 1 }).endOf("month").format("YYYY-MM-DD");

  const inMonth = (m) => {
    const d = m.movement_date || "";
    return d >= monthStart && d <= monthEnd;
  };

  const monthMovements = useMemo(() => movements.filter(inMonth), [movements, monthStart, monthEnd]);

  // Desglose por rubro (del mes)
  const byRubro = useMemo(() => {
    const map = {};
    monthMovements.forEach((m) => {
      const key = m.rubro_name || "Sin rubro";
      if (!map[key]) map[key] = { name: key, kind: m.movement_type, total: 0 };
      map[key].total += Number(m.amount) || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthMovements]);

  // Índice de rubros por id (para resolver tratamiento contable de cada movimiento)
  const rubrosById = useMemo(() => {
    const map = {};
    rubros.forEach((r) => { map[r.id] = r; });
    return map;
  }, [rubros]);

  // Estado de Resultados real del mes: parte operativa automática (ventas, COGS,
  // pagos a proveedores) fusionada con los gastos/ingresos manuales operativos.
  const incomeStatement = useMemo(() => {
    const inRange = (dateStr) => dateStr >= monthStart && dateStr <= monthEnd;

    const periodQuotations = quotations.filter((q) => inRange(getDateStringMexico(q.created_date)));
    const periodMovements = stockMovements.filter((m) => inRange(getDateStringMexico(m.created_date)));
    const periodSupplierPayments = supplierPayments.filter((p) => inRange(p.payment_date || ""));

    const op = computeSalesData({
      periodQuotations,
      periodMovements,
      periodSupplierPayments,
      products,
      quotations,
    });

    // Manuales: solo rubros operativos suman al resultado (anti doble conteo)
    let manualIncome = 0, manualExpense = 0;
    monthMovements.forEach((m) => {
      if (!isOperatingMovement(m, rubrosById)) return;
      if (m.movement_type === "income") manualIncome += Number(m.amount) || 0;
      else manualExpense += Number(m.amount) || 0;
    });

    const salesRevenue = op.salesRevenue;                 // Ventas devengadas
    const cogs = op.salesCost;                            // Costo de ventas
    const grossProfit = salesRevenue - cogs;             // Utilidad Bruta
    const realProfit = grossProfit + manualIncome - manualExpense; // Utilidad Real
    const supplierPaymentsTotal = op.supplierPaymentsTotal;
    const netProfit = realProfit - supplierPaymentsTotal; // Utilidad Neta
    const pendingCollection = salesRevenue - op.realRevenue; // pendiente de cobrar (informativo)

    return {
      salesRevenue,
      cogs,
      grossProfit,
      manualIncome,
      manualExpense,
      realProfit,
      supplierPaymentsTotal,
      netProfit,
      pendingCollection,
      hasOperations: salesRevenue !== 0 || cogs !== 0 || supplierPaymentsTotal !== 0 || manualIncome !== 0 || manualExpense !== 0,
    };
  }, [quotations, stockMovements, supplierPayments, products, monthMovements, rubrosById, monthStart, monthEnd]);

  // Proyección de utilidad (solo si el negocio activó el pronóstico)
  const forecast = useMemo(() => {
    if (!forecastEnabled) return null;
    const todayStr = getDateStringMexico(new Date().toISOString());

    // Tasa de conversión histórica (últimos 30 días)
    const thirty = new Date();
    thirty.setDate(thirty.getDate() - 30);
    const thirtyStr = getDateStringMexico(thirty.toISOString());
    const windowQuots = quotations.filter((q) => getDateStringMexico(q.created_date) >= thirtyStr);
    const { rate: conversionRate } = computeConversionRate(windowQuots);

    return computeForecast({
      realizedNetProfit: incomeStatement.netProfit,
      monthStart,
      monthEnd,
      todayStr,
      activeQuotations: getActiveQuotations(quotations),
      conversionRate,
      products,
    });
  }, [forecastEnabled, quotations, products, incomeStatement.netProfit, monthStart, monthEnd]);

  const handleToggleForecast = async (next) => {
    setForecastEnabled(next); // optimista
    try {
      if (appSettings?.id) {
        await base44.entities.AppSettings.update(appSettings.id, { utility_forecast_enabled: next });
      } else {
        const created = await base44.entities.AppSettings.create({ business_id: businessId, utility_forecast_enabled: next });
        setAppSettings(created);
      }
      toast.success(next ? "Proyección activada" : "Proyección desactivada");
    } catch (err) {
      console.error("No se pudo guardar la preferencia de proyección", err);
      setForecastEnabled(!next); // revertir
      toast.error("No se pudo guardar la preferencia");
    }
  };

  // Historial filtrado (del mes seleccionado)
  const filtered = useMemo(() => {
    return monthMovements.filter((m) => {
      if (filterType !== "all" && m.movement_type !== filterType) return false;
      if (filterRubro !== "all" && m.rubro_id !== filterRubro) return false;
      if (filterAccount !== "all" && m.account_id !== filterAccount) return false;
      return true;
    });
  }, [monthMovements, filterType, filterRubro, filterAccount]);

  const yearOptions = useMemo(() => {
    const years = new Set([now.year()]);
    movements.forEach((m) => { if (m.movement_date) years.add(Number(m.movement_date.slice(0, 4))); });
    return Array.from(years).sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements]);

  const openForm = (type) => { setEditingMovement(null); setFormType(type); setFormOpen(true); };
  const openEdit = (m) => { setEditingMovement(m); setFormType(m.movement_type); setFormOpen(true); };

  const handleDeleteConfirm = async () => {
    const target = deletingMovement;
    if (!target) return;
    try {
      if (target.affects_petty_cash && target.petty_cash_movement_id) {
        await base44.entities.PettyCashMovement.delete(target.petty_cash_movement_id)
          .catch((err) => console.warn("No se pudo eliminar espejo de caja chica", err));
      }
      await base44.entities.UtilityMovement.delete(target.id);
      toast.success("Movimiento eliminado");
      setDeletingMovement(null);
      await load();
    } catch (err) {
      console.error("Delete utility movement error:", err);
      toast.error("No se pudo eliminar el movimiento");
    }
  };

  if (!businessId) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <Wallet className="h-12 w-12 text-slate-300" />
      <p className="text-slate-500">No se encontró un negocio asociado a tu cuenta.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-500" /> Utilidad
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Estado de resultados real del mes: ventas y costos automáticos + gastos que capturas a mano</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-muted/50 rounded-lg px-3 py-2 cursor-pointer select-none">
            <Sparkles className={`h-4 w-4 ${forecastEnabled ? "text-indigo-500" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Proyección</span>
            <Switch checked={forecastEnabled} onCheckedChange={handleToggleForecast} />
          </label>
          <Button onClick={() => openForm("income")} className="bg-emerald-600 hover:bg-emerald-700" {...createButtonProps('add')}>
            <Plus className="h-4 w-4 mr-1" /> Ingreso
          </Button>
          <Button onClick={() => openForm("expense")} className="bg-rose-600 hover:bg-rose-700" {...createButtonProps('add')}>
            <Minus className="h-4 w-4 mr-1" /> Egreso
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <span className="text-xs text-slate-500">Mes</span>
          <MobileSelect
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
            triggerClassName="w-40"
            options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
          />
        </div>
        <div>
          <span className="text-xs text-slate-500">Año</span>
          <MobileSelect
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
            triggerClassName="w-28"
            options={yearOptions}
          />
        </div>
      </div>

      {/* Summary cards — cifras reales del Estado de Resultados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Ventas del mes</span>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmt(incomeStatement.salesRevenue)}</p>
          <p className="text-muted-foreground text-xs mt-1">Devengado · {MONTHS[month]} {year}</p>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Utilidad Real</span>
            <Scale className="h-5 w-5 text-emerald-500" />
          </div>
          <p className={`text-2xl font-bold ${incomeStatement.realProfit < 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(incomeStatement.realProfit)}</p>
          <p className="text-muted-foreground text-xs mt-1">Ventas − COGS − gastos</p>
        </Card>

        <Card className={`border-0 shadow-sm p-5 text-white bg-gradient-to-br ${incomeStatement.netProfit < 0 ? "from-rose-500 to-rose-600" : "from-indigo-500 to-indigo-600"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-indigo-100 text-sm font-medium">Utilidad Neta</span>
            <Wallet className="h-5 w-5 text-indigo-200" />
          </div>
          <p className="text-3xl font-bold">{fmt(incomeStatement.netProfit)}</p>
          <p className="text-indigo-100 text-xs mt-1">− pagos a proveedores</p>
        </Card>
      </div>

      {/* Estado de Resultados — cascada */}
      <Card className="border-0 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Scale className="h-4 w-4 text-indigo-500" /> Estado de Resultados — {MONTHS[month]} {year}
        </h2>
        {!incomeStatement.hasOperations ? (
          <p className="text-sm text-slate-400 py-4 text-center">Sin operaciones ni movimientos en {MONTHS[month]} {year}</p>
        ) : (
          <div className="space-y-1.5 text-sm">
            <Row label="Ventas (devengado)" value={incomeStatement.salesRevenue} sign="+" />
            <Row label="Costo de ventas (COGS)" value={incomeStatement.cogs} sign="−" muted />
            <Divider />
            <Row label="Utilidad Bruta" value={incomeStatement.grossProfit} bold />
            {incomeStatement.manualIncome > 0 && <Row label="Otros ingresos" value={incomeStatement.manualIncome} sign="+" />}
            <Row label="Gastos operativos" value={incomeStatement.manualExpense} sign="−" muted />
            <Divider />
            <Row label="Utilidad Real" value={incomeStatement.realProfit} bold highlight />
            <Row label="Pagos a proveedores" value={incomeStatement.supplierPaymentsTotal} sign="−" muted />
            <Divider />
            <Row label="Utilidad Neta" value={incomeStatement.netProfit} bold highlight />
            {incomeStatement.pendingCollection > 0 && (
              <p className="text-xs text-amber-600 pt-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pendiente de cobrar (no afecta la utilidad devengada): {fmt(incomeStatement.pendingCollection)}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Proyección (pronóstico) */}
      {forecastEnabled && forecast && (
        <Card className="border border-indigo-200 dark:border-indigo-900 shadow-sm p-5 bg-indigo-50/40 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <LineChart className="h-4 w-4 text-indigo-500" /> Proyección — {MONTHS[month]} {year}
            </h2>
            <Badge className="bg-indigo-100 text-indigo-700 border-0 text-[10px]">estimado</Badge>
          </div>
          {forecast.isClosed ? (
            <p className="text-sm text-slate-400 py-3 text-center">Mes cerrado — la utilidad ya es definitiva.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Utilidad Neta proyectada</span>
                <span className={`text-2xl font-bold ${forecast.projectedNetProfit < 0 ? "text-rose-600" : "text-indigo-600 dark:text-indigo-400"}`}>
                  {fmt(forecast.projectedNetProfit)}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label="Realizado hasta hoy" value={incomeStatement.netProfit} />
                <Row
                  label={`Pipeline esperado (${forecast.activeCount} activas × ${(forecast.conversionRate * 100).toFixed(0)}% conversión)`}
                  value={forecast.expectedPipelineProfit}
                  sign="+"
                />
                {!forecast.isFuture && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-indigo-400" />
                    Al ritmo actual ({forecast.daysElapsed}/{forecast.daysInMonth} días) cerrarías cerca de {fmt(forecast.runRateNet)}.
                  </p>
                )}
                <p className="text-[11px] text-slate-400 pt-1">
                  Estimación: utilidad realizada + cotizaciones activas ponderadas por tu tasa de conversión histórica (30 días). No incluye gastos fijos aún no registrados.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Desglose por rubro */}
      <Card className="border-0 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Desglose por rubro</h2>
        {byRubro.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Sin movimientos en {MONTHS[month]} {year}</p>
        ) : (
          <div className="space-y-2">
            {byRubro.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge className={`${r.kind === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} border-0 text-xs`}>
                    {r.kind === "income" ? "Ingreso" : "Egreso"}
                  </Badge>
                  <span className="text-slate-700">{r.name}</span>
                </span>
                <span className={`font-semibold ${r.kind === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.kind === "income" ? "+" : "−"} {fmt(r.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Historial */}
      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-border flex flex-wrap gap-3 items-end">
          <div>
            <span className="text-xs text-slate-500">Tipo</span>
            <MobileSelect
              value={filterType}
              onValueChange={setFilterType}
              triggerClassName="w-32"
              options={[
                { value: "all", label: "Todos" },
                { value: "income", label: "Ingresos" },
                { value: "expense", label: "Egresos" },
              ]}
            />
          </div>
          <div>
            <span className="text-xs text-slate-500">Rubro</span>
            <MobileSelect
              value={filterRubro}
              onValueChange={setFilterRubro}
              triggerClassName="w-44"
              options={[{ value: "all", label: "Todos" }, ...rubros.map((r) => ({ value: r.id, label: r.name }))]}
            />
          </div>
          <div>
            <span className="text-xs text-slate-500">Cuenta</span>
            <MobileSelect
              value={filterAccount}
              onValueChange={setFilterAccount}
              triggerClassName="w-44"
              options={[{ value: "all", label: "Todas" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Fecha</TableHead>
                <TableHead>Rubro</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="hidden md:table-cell">Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                    Sin movimientos con estos filtros
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const isIncome = m.movement_type === "income";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                        {m.movement_date ? moment(m.movement_date).format("DD/MM/YY") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${isIncome ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} border-0 text-xs`}>
                          {m.rubro_name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <span className="flex items-center gap-1">
                          {m.account_name || "—"}
                          {m.affects_petty_cash && <Lock className="h-3 w-3 text-slate-400" title="Reflejado en Caja Chica" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm hidden md:table-cell max-w-[220px] truncate" title={m.description}>
                        {m.description || "—"}
                      </TableCell>
                      <TableCell className={`text-right font-semibold whitespace-nowrap ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                        {isIncome ? "+" : "−"} {fmt(m.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} {...createButtonProps('edit')}>
                          <Pencil className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingMovement(m)} {...createButtonProps('delete')}>
                          <Trash2 className="h-4 w-4 text-rose-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Form modal */}
      {formOpen && (
        <UtilityMovementForm
          open={formOpen}
          movementType={formType}
          businessId={businessId}
          rubros={rubros}
          accounts={accounts}
          movement={editingMovement}
          onSaved={load}
          onClose={() => { setFormOpen(false); setEditingMovement(null); }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingMovement} onOpenChange={(open) => !open && setDeletingMovement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
              {deletingMovement?.affects_petty_cash && (
                <span className="block mt-2 text-rose-600">También se eliminará el movimiento asociado en Caja Chica.</span>
              )}
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
