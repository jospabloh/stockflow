import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Save, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define real permission structure based on actual page elements
const PAGE_ELEMENTS = {
  Dashboard: {
    label: "Dashboard",
    elements: [
      { id: "summary_card", label: "Tarjeta de Resumen", icon: "📊", description: "Información general del negocio" },
      { id: "low_stock_alert", label: "Alerta de Stock Bajo", icon: "⚠️", description: "Productos con stock bajo" },
      { id: "recent_movements", label: "Movimientos Recientes", icon: "📈", description: "Últimas transacciones" },
      { id: "sales_report", label: "Reporte de Ventas", icon: "💰", description: "Análisis de ventas" },
      { id: "financial_summary", label: "Resumen Financiero", icon: "💵", description: "Información financiera delicada" },
    ]
  },
  Products: {
    label: "Productos",
    elements: [
      { id: "product_list", label: "Lista de Productos", icon: "📦", description: "Ver todos los productos" },
      { id: "create_product", label: "Crear Producto", icon: "➕", description: "Agregar nuevos productos" },
      { id: "edit_product", label: "Editar Producto", icon: "✏️", description: "Modificar detalles de productos" },
      { id: "delete_product", label: "Eliminar Producto", icon: "🗑️", description: "Borrar productos del sistema" },
      { id: "import_products", label: "Importar Productos", icon: "📥", description: "Carga masiva de productos" },
      { id: "cost_price", label: "Ver Precio de Costo", icon: "💲", description: "Información de costo (confidencial)" },
    ]
  },
  Quotations: {
    label: "Cotizaciones",
    elements: [
      { id: "quotation_list", label: "Ver Cotizaciones", icon: "📄", description: "Listar todas las cotizaciones" },
      { id: "create_quotation", label: "Crear Cotización", icon: "➕", description: "Crear nuevas cotizaciones" },
      { id: "edit_quotation", label: "Editar Cotización", icon: "✏️", description: "Modificar cotizaciones" },
      { id: "convert_quotation", label: "Convertir a Venta", icon: "✓", description: "Finalizar cotizaciones" },
      { id: "delete_quotation", label: "Eliminar Cotización", icon: "🗑️", description: "Cancelar cotizaciones" },
      { id: "pricing_details", label: "Ver Detalles de Precio", icon: "💲", description: "Márgenes y cálculos" },
    ]
  },
  Movements: {
    label: "Movimientos",
    elements: [
      { id: "movement_list", label: "Ver Movimientos", icon: "📋", description: "Historial de movimientos" },
      { id: "create_movement", label: "Crear Movimiento", icon: "➕", description: "Registrar entrada/salida" },
      { id: "edit_movement", label: "Editar Movimiento", icon: "✏️", description: "Ajustar movimientos" },
      { id: "delete_movement", label: "Eliminar Movimiento", icon: "🗑️", description: "Borrar registros" },
    ]
  },
  PettyCash: {
    label: "Caja Chica",
    elements: [
      { id: "petty_cash_view", label: "Ver Caja Chica", icon: "🏦", description: "Saldo actual y movimientos" },
      { id: "petty_cash_add", label: "Agregar Fondo", icon: "➕", description: "Aumentar caja chica" },
      { id: "petty_cash_expense", label: "Registrar Egreso", icon: "➖", description: "Gastos de caja chica" },
      { id: "petty_cash_income", label: "Registrar Ingreso", icon: "⬆️", description: "Ingresos a caja chica" },
    ]
  },
};

export default function GranularPermissionManager({ perms, onPermChange, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [expandedPage, setExpandedPage] = useState("Dashboard");
  const currentPerms = perms?.almacenista_elements || {};

  const handleToggleElement = (page, elementId) => {
    if (!editMode) return;
    const key = `${page}:${elementId}`;
    const current = currentPerms[key] ?? true; // Default true (visible)
    onPermChange('almacenista_elements', key, !current);
  };

  const getPageStats = (page) => {
    const elements = PAGE_ELEMENTS[page].elements;
    const visible = elements.filter(el => currentPerms[`${page}:${el.id}`] !== false).length;
    return { visible, total: elements.length };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestión de Permisos por Elemento</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {editMode 
              ? "Modo edición - Selecciona qué elementos ve el almacenista en cada página" 
              : "Modo vista - Revisa qué elementos son visibles"}
          </p>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={onSave}>
                <Save className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Edit2 className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-700">
          Cada elemento puede ser <strong>visible</strong> (✓) u <strong>oculto</strong> (✗) para el almacenista. 
          {editMode && " Haz clic en los elementos para alternar su visibilidad."}
        </p>
      </Card>

      {/* Tabbed interface for pages */}
      <Tabs value={expandedPage} onValueChange={setExpandedPage} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          {Object.entries(PAGE_ELEMENTS).map(([page, config]) => {
            const stats = getPageStats(page);
            return (
              <TabsTrigger key={page} value={page} className="relative">
                <span>{config.label}</span>
                <Badge variant="outline" className="ml-2 h-5 px-1.5 text-xs">
                  {stats.visible}/{stats.total}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Page content */}
        {Object.entries(PAGE_ELEMENTS).map(([page, config]) => (
          <TabsContent key={page} value={page} className="space-y-3">
            <div className="grid gap-2">
              {config.elements.map(element => {
                const key = `${page}:${element.id}`;
                const isVisible = currentPerms[key] !== false;
                
                return (
                  <Card
                    key={element.id}
                    className={`p-4 transition-all border-2 ${
                      isVisible
                        ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-red-50 border-red-300 hover:bg-red-100'
                    } ${editMode ? 'cursor-pointer' : ''}`}
                    onClick={() => handleToggleElement(page, element.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{element.icon}</div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{element.label}</h4>
                          {!isVisible && (
                            <Badge className="bg-red-200 text-red-800 border-0">Oculto</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{element.description}</p>
                      </div>

                      {editMode ? (
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={(checked) => handleToggleElement(page, element.id)}
                          className="w-6 h-6 flex-shrink-0 mt-1"
                        />
                      ) : (
                        <div className={`text-2xl font-bold flex-shrink-0 ${isVisible ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isVisible ? '✓' : '✗'}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Summary for this page */}
            {(() => {
              const stats = getPageStats(page);
              const hidden = config.elements.filter(el => currentPerms[`${page}:${el.id}`] === false);
              
              return hidden.length > 0 && (
                <Card className="p-3 mt-4 bg-amber-50 border-amber-300">
                  <p className="text-xs font-semibold text-amber-900 mb-2">
                    {hidden.length} elemento(s) oculto(s) para almacenista:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hidden.map(el => (
                      <Badge key={el.id} className="bg-red-200 text-red-800 border-0">
                        {el.icon} {el.label}
                      </Badge>
                    ))}
                  </div>
                </Card>
              );
            })()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}