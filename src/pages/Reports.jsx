import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";
import moment from "moment";
import OperationalReports from "@/components/reports/OperationalReports";
import PredictiveReports from "@/components/reports/PredictiveReports";

export default function Reports() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dateFrom, setDateFrom] = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      const bId = u?.business_id;
      setIsAdmin(admin);
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
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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
                <span className="font-bold text-emerald-700">${totalSalesValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[11px] text-slate-400 ml-6">
                Cot: ${totalSalesFromQuotations.toLocaleString("es-MX", { minimumFractionDigits: 2 })} · Directas: ${totalSalesFromDirectExits.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-slate-500">Compras:</span>
                <span className="font-bold text-blue-700">${totalPurchaseValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Capas de Reportes */}
      <Tabs defaultValue={isAdmin ? "predictive" : "operational"} className="space-y-6">
        <TabsList className="bg-white shadow-sm border flex-wrap h-auto gap-1 p-1">
          {/* OPERACIONAL - visible para todos */}
          <TabsTrigger value="operational" className="font-medium">📊 Reportes Operacionales</TabsTrigger>
          
          {/* PREDICTIVO - solo para admins */}
          {isAdmin && (
            <TabsTrigger value="predictive" className="font-medium">🔮 Análisis Inteligente</TabsTrigger>
          )}
        </TabsList>

        {/* LAYER 1: REPORTES OPERACIONALES */}
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

        {/* LAYER 2: REPORTES PREDICTIVOS / INTELIGENTES - Solo para Admins */}
        {isAdmin && (
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