import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";
import moment from "moment";
import OperationalReports from "@/components/reports/OperationalReports";
import PredictiveReports from "@/components/reports/PredictiveReports";
import SupplierPaymentsReportChart from "@/components/dashboard/SupplierPaymentsReportChart";
import UnbilledNonCashInvoiceReport from "@/components/reports/UnbilledNonCashInvoiceReport";

export default function Reports() {
  const { can } = usePermissions();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [quotationsCapped, setQuotationsCapped] = useState(false);
  const [dateFrom, setDateFrom] = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      const bId = u?.business_id;
      setIsAdmin(admin);
      setBusinessId(bId);
      const [prods, movs, cats] = await Promise.all([
        base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
        base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
        base44.entities.Category.filter({ business_id: bId }),
      ]);
      setProducts(prods);
      setMovements(movs);
      setCategories(cats);
      const quots = await base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 500).catch(() => []);
      setQuotations(quots);
      setQuotationsCapped(quots.length === 500);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refetchQuotations = async () => {
    if (!businessId) return;
    const quots = await base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 500).catch(() => []);
    setQuotations(quots);
    setQuotationsCapped(quots.length === 500);
  };

  // Cálculos para summary superior
  const filteredMovements = movements.filter((m) => {
    const date = moment(m.created_date);
    return date.isSameOrAfter(dateFrom) && date.isSameOrBefore(moment(dateTo).endOf("day"));
  });

  const convertedInRange = quotations.filter((q) => {
    const date = moment(q.created_date);
    return q.status === "converted" &&
      date.isSameOrAfter(dateFrom) &&
      date.isSameOrBefore(moment(dateTo).endOf("day"));
  });
  const directExitsInRange = filteredMovements.filter((m) => m.type === "exit" && !m.quotation_id);
  const totalSalesFromQuotations = convertedInRange.reduce((sum, q) => sum + (q.total || 0), 0);
  const totalSalesFromDirectExits = directExitsInRange.reduce((sum, m) => sum + (m.total || 0), 0);
  const totalSalesValue = totalSalesFromQuotations + totalSalesFromDirectExits;
  const totalPurchaseValue = filteredMovements
    .filter((m) => m.type === "entry")
    .reduce((sum, m) => sum + (m.total || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Date filter */}
      <Card className="border-0 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <Label className="text-xs text-slate-500">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-500">Total ventas:</span>
                <span className="font-bold text-emerald-700"><span className="font-mono tabular">${totalSalesValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></span>
              </div>
              <p className="text-[11px] text-slate-400 ml-6">
                Cot: <span className="tabular">${totalSalesFromQuotations.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span> · Directas: <span className="tabular">${totalSalesFromDirectExits.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
            {can('Reportes', 'cost_view') && (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-slate-500">Compras:</span>
                <span className="font-bold text-blue-700"><span className="font-mono tabular">${totalPurchaseValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Capas de Reportes */}
      <Tabs defaultValue={isAdmin ? "predictive" : "operational"} className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1">
          {/* OPERACIONAL */}
          {can('Reportes', 'operational') && (
            <TabsTrigger value="operational" className="font-medium">📊 Reportes Operacionales</TabsTrigger>
          )}

          {/* PAGOS A PROVEEDORES */}
          {can('Reportes', 'supplier') && (
            <TabsTrigger value="suppliers" className="font-medium">💸 Pagos a Proveedores</TabsTrigger>
          )}

          {/* FACTURACIÓN PÚBLICO GENERAL (no-efectivo, no facturado) */}
          {can('Reportes', 'billing') && (
            <TabsTrigger value="billing" className="font-medium">🧾 Facturación Público General</TabsTrigger>
          )}

          {/* PREDICTIVO */}
          {can('Reportes', 'predictive') && (
            <TabsTrigger value="predictive" className="font-medium">🔮 Análisis Inteligente</TabsTrigger>
          )}
        </TabsList>

        {/* LAYER 1: REPORTES OPERACIONALES */}
        {can('Reportes', 'operational') && (
          <TabsContent value="operational">
            <OperationalReports
              quotations={quotations}
              movements={movements}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={(df, dt) => {
                setDateFrom(df);
                setDateTo(dt);
              }}
            />
          </TabsContent>
        )}

        {/* LAYER 1.5: PAGOS A PROVEEDORES */}
        {can('Reportes', 'supplier') && (
          <TabsContent value="suppliers">
            <SupplierPaymentsReportChart dateFrom={dateFrom} dateTo={dateTo} />
          </TabsContent>
        )}

        {/* FACTURACIÓN PÚBLICO GENERAL */}
        {can('Reportes', 'billing') && (
          <TabsContent value="billing">
            <UnbilledNonCashInvoiceReport
              quotations={quotations}
              onQuotationsUpdated={refetchQuotations}
              canAssign={can('Cotizaciones', 'edit_invoice_status')}
              quotationsCapped={quotationsCapped}
            />
          </TabsContent>
        )}

        {/* LAYER 2: REPORTES PREDICTIVOS / INTELIGENTES */}
        {can('Reportes', 'predictive') && (
          <TabsContent value="predictive">
            <PredictiveReports
              products={products}
              movements={movements}
              quotations={quotations}
              categories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}