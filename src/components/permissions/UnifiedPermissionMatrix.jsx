import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Save, X, RotateCcw, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Matriz completa de funcionalidades por módulo
export const PERMISSION_MATRIX = {
  Dashboard: {
    label: "Dashboard",
    actions: [
      { id: "view", label: "Ver página", icon: "👁️", description: "Acceso a la página principal del dashboard" },
      { id: "summary", label: "Tarjeta resumen", icon: "📊", description: "Ver resumen rápido de inventario y ventas" },
      { id: "low_stock", label: "Alerta stock bajo", icon: "⚠️", description: "Ver productos con stock bajo o agotado" },
      { id: "recent_movements", label: "Movimientos recientes", icon: "📈", description: "Ver últimos movimientos de inventario" },
      { id: "sales_report", label: "Reporte ventas", icon: "💰", description: "Ver reporte de ventas y cotizaciones" },
      { id: "financial", label: "Resumen financiero", icon: "💵", description: "Ver resumen financiero y caja chica" },
    ]
  },
  Productos: {
    label: "Productos",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso a la lista de productos" },
      { id: "create", label: "Crear producto", icon: "➕", description: "Crear nuevos productos en el catálogo" },
      { id: "edit", label: "Editar básico", icon: "✏️", description: "Editar nombre, descripción, categoría" },
      { id: "edit_stock", label: "Editar stock inicial", icon: "📦", description: "Establecer stock inicial y stock mínimo" },
      { id: "edit_prices", label: "Editar precios", icon: "💵", description: "Modificar precios de venta (menudeo y mayoreo)" },
      { id: "edit_cost", label: "Editar precio costo", icon: "💲", sensitive: true, description: "Modificar precio de compra (información sensible)" },
      { id: "edit_suppliers", label: "Editar proveedores", icon: "🏢", description: "Asignar o cambiar proveedores de productos" },
      { id: "edit_attributes", label: "Editar atributos", icon: "⚙️", description: "Modificar SKU, código de barras, unidad de medida" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar productos del catálogo" },
      { id: "import", label: "Importar", icon: "📥", description: "Importar productos desde archivo CSV/Excel" },
      { id: "barcode", label: "Generar códigos", icon: "📱", description: "Generar y descargar códigos de barras" },
      { id: "cost_price", label: "Ver costo (confidencial)", icon: "💲", sensitive: true, description: "Ver precio de costo de productos en listados (información sensible)" },
      { id: "wholesale", label: "Ver precios mayoreo", icon: "📦", description: "Ver y editar precios mayoristas" },
    ]
  },
  Categorías: {
    label: "Categorías",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso a la lista de categorías de productos" },
      { id: "create", label: "Crear", icon: "➕", description: "Crear nuevas categorías de productos" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar categorías existentes" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar categorías del sistema" },
    ]
  },
  Proveedores: {
    label: "Proveedores",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso a la lista de proveedores" },
      { id: "create", label: "Crear", icon: "➕", description: "Agregar nuevos proveedores al catálogo" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar datos de proveedores" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar proveedores del sistema" },
    ]
  },
  Clientes: {
    label: "Clientes",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso a la lista de clientes" },
      { id: "create", label: "Crear", icon: "➕", description: "Registrar nuevos clientes" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar datos de clientes existentes" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar clientes del sistema" },
      { id: "force_wholesale", label: "Precios mayoreo forzado", icon: "💲", description: "Aplicar precios mayoristas automáticamente a este cliente" },
      { id: "force_purchase", label: "Precios compra forzado", icon: "💲", sensitive: true, description: "Aplicar precios de compra a cliente (información sensible)" },
    ]
  },
  "Tipo de Pago": {
    label: "Tipo de Pago",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Ver métodos de pago configurados" },
      { id: "create", label: "Crear", icon: "➕", description: "Crear nuevos métodos de pago" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar métodos de pago existentes" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar métodos de pago" },
    ]
  },
  Movimientos: {
    label: "Movimientos",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso al registro de movimientos de inventario" },
      { id: "create", label: "Crear movimiento", icon: "➕", description: "Crear nuevos movimientos de inventario" },
      { id: "entry", label: "Entrada de stock", icon: "⬆️", description: "Registrar entrada de productos al almacén" },
      { id: "exit", label: "Salida de stock", icon: "⬇️", description: "Registrar salida de productos del almacén" },
      { id: "return", label: "Devolución", icon: "↩️", description: "Procesar devoluciones de productos" },
      { id: "adjustment", label: "Ajuste de inventario", icon: "⚙️", description: "Realizar ajustes manuales de stock" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar movimientos existentes" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar movimientos del registro" },
      { id: "confirm_payment", label: "Confirmar pago", icon: "✓", description: "Marcar movimientos como pagados" },
    ]
  },
  Cotizaciones: {
    label: "Cotizaciones",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso al listado de cotizaciones" },
      { id: "create", label: "Crear", icon: "➕", description: "Crear nuevas cotizaciones para clientes" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar cotizaciones existentes" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar cotizaciones" },
      { id: "convert", label: "Convertir a venta", icon: "✓", description: "Convertir cotización a venta confirmada" },
      { id: "cancel", label: "Cancelar", icon: "❌", description: "Cancelar cotizaciones" },
      { id: "return", label: "Procesar devolución", icon: "↩️", description: "Procesar devoluciones parciales de ventas" },
      { id: "pricing", label: "Ver detalles precio", icon: "💲", sensitive: true, description: "Ver cálculo detallado de precios (información sensible)" },
      { id: "send", label: "Enviar cotización", icon: "📧", description: "Enviar cotizaciones por correo a clientes" },
      { id: "export", label: "Exportar PDF", icon: "📄", description: "Exportar cotizaciones en formato PDF" },
    ]
  },
  "Caja Chica": {
    label: "Caja Chica",
    actions: [
      { id: "view", label: "Ver saldo", icon: "👁️", description: "Ver saldo actual de caja chica" },
      { id: "view_history", label: "Ver historial", icon: "📋", description: "Acceso al historial completo de movimientos" },
      { id: "add_fund", label: "Agregar fondo", icon: "➕", description: "Agregar fondos iniciales o adicionales a caja" },
      { id: "expense", label: "Registrar egreso", icon: "➖", description: "Registrar gastos o egresos de caja chica" },
      { id: "income", label: "Registrar ingreso", icon: "⬆️", description: "Registrar ingresos a caja chica" },
      { id: "edit", label: "Editar movimiento", icon: "✏️", description: "Modificar movimientos de caja registrados" },
      { id: "delete", label: "Eliminar movimiento", icon: "🗑️", description: "Eliminar movimientos de caja" },
    ]
  },
  "Pagos a Proveedores": {
    label: "Pagos a Proveedores",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️", description: "Acceso al registro de pagos a proveedores" },
      { id: "create", label: "Crear pago", icon: "➕", description: "Registrar nuevos pagos a proveedores" },
      { id: "edit", label: "Editar", icon: "✏️", description: "Modificar pagos registrados" },
      { id: "delete", label: "Eliminar", icon: "🗑️", description: "Eliminar registro de pagos" },
    ]
  },
  Reportes: {
    label: "Reportes",
    actions: [
      { id: "view", label: "Ver reportes", icon: "👁️", description: "Acceso a visualización de reportes" },
      { id: "operational", label: "Reportes operacionales", icon: "📊", description: "Reportes de operaciones, inventario y ventas" },
      { id: "predictive", label: "Reportes predictivos", icon: "🔮", description: "Análisis predictivo y tendencias" },
      { id: "export", label: "Exportar datos", icon: "📥", description: "Exportar reportes y datos en Excel/CSV" },
    ]
  },
  Configuración: {
    label: "Configuración",
    actions: [
      { id: "view", label: "Ver configuración", icon: "⚙️", description: "Acceso a configuración general del sistema" },
      { id: "business", label: "Datos negocio", icon: "🏢", description: "Editar datos de la empresa (nombre, RFC, etc.)" },
      { id: "app_settings", label: "Configuración app", icon: "🎨", description: "Personalizar apariencia y configuración de la app" },
      { id: "import_products", label: "Importar productos", icon: "📥", description: "Importar catálogo de productos desde archivo" },
      { id: "manage_clients", label: "Gestionar clientes", icon: "👥", description: "Administrar información de clientes" },
    ]
  },
};

const ROLES = [
  { id: "admin", label: "Admin", color: "bg-purple-50 border-purple-200" },
  { id: "almacenista", label: "Almacenista", color: "bg-blue-50 border-blue-200" },
];

export default function UnifiedPermissionMatrix({ perms, onPermChange, onSave, saving }) {
  const [editMode, setEditMode] = useState(false);
  const [activeRole, setActiveRole] = useState("admin");
  
  // Cargar permisos por defecto de almacenista si está vacío
  const getDefaultAlmacenista = () => {
    return {
      "Productos:view": true,
      "Productos:barcode": true,
      "Movimientos:view": true,
      "Movimientos:entry": true,
      "Movimientos:exit": true,
      "Movimientos:adjustment": true,
      "Cotizaciones:view": true,
      "Caja Chica:view": true,
      "Caja Chica:view_history": true,
    };
  };
  
  const currentRolePerms = activeRole === "almacenista" && (!perms?.[activeRole] || Object.keys(perms[activeRole]).length === 0)
    ? getDefaultAlmacenista()
    : (perms?.[activeRole] || {});

  // Stats
  const stats = useMemo(() => {
    const total = Object.values(PERMISSION_MATRIX).reduce(
      (sum, module) => sum + module.actions.length,
      0
    );
    const granted = Object.keys(currentRolePerms).filter(
      k => currentRolePerms[k] === true
    ).length;
    return { granted, total };
  }, [currentRolePerms]);

  const handleToggle = (key) => {
    if (!editMode) return;
    const current = currentRolePerms[key] ?? true;
    onPermChange(activeRole, key, !current);
  };

  const resetToDefaults = () => {
    if (!window.confirm(`¿Restaurar permisos por defecto para ${activeRole}?`)) return;
    const defaults = activeRole === "admin" 
      ? Object.keys(PERMISSION_MATRIX).reduce((acc, module) => {
          PERMISSION_MATRIX[module].actions.forEach(a => {
            acc[`${module}:${a.id}`] = true;
          });
          return acc;
        }, {})
      : getDefaultAlmacenista();
    
    Object.keys(defaults).forEach(key => {
      onPermChange(activeRole, key, defaults[key]);
    });
  };

  const selectAll = () => {
    Object.entries(PERMISSION_MATRIX).forEach(([module, data]) => {
      data.actions.forEach(action => {
        onPermChange(activeRole, `${module}:${action.id}`, true);
      });
    });
  };

  const selectNone = () => {
    Object.keys(currentRolePerms).forEach(key => {
      onPermChange(activeRole, key, false);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Matriz de Permisos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {editMode
                ? "Edita los permisos seleccionando o deseleccionando cada funcionalidad"
                : "Visualiza todos los permisos del sistema"}
            </p>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => onSave(activeRole)}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                <Edit2 className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>

        {/* Role tabs */}
         <Tabs value={activeRole} onValueChange={setActiveRole}>
           <TabsList>
             {ROLES.map(role => {
               const rolePerms = perms?.[role.id] || {};
               const granted = Object.keys(rolePerms).filter(k => rolePerms[k] === true).length;
               return (
                 <TabsTrigger key={role.id} value={role.id}>
                   <span>{role.label}</span>
                   <Badge variant="outline" className="ml-2 h-5 px-1.5 text-xs">
                     {granted}/{stats.total}
                   </Badge>
                 </TabsTrigger>
               );
             })}
           </TabsList>
         </Tabs>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>✓ Verde:</strong> Permiso otorgado
          </p>
        </Card>
        <Card className="p-3 bg-slate-100 border-slate-300">
          <p className="text-sm text-slate-700">
            <strong>○ Gris:</strong> Permiso denegado
          </p>
        </Card>
      </div>

      {/* Control buttons */}
      {editMode && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            ✓ Seleccionar todo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectNone}
            className="text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            ○ Ninguno
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar valores por defecto
          </Button>
        </div>
      )}

      {/* Matriz */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border sticky top-0">
                <th className="text-left px-4 py-3 font-semibold min-w-[180px] bg-muted/60">
                  Módulo
                </th>
                <th className="text-left px-4 py-3 font-semibold bg-muted/60">
                  Funcionalidad
                </th>
                <th className="text-center px-3 py-3 font-semibold bg-muted/60 min-w-[60px]">
                  {activeRole === "admin" ? "Admin" : "Almac."}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSION_MATRIX).map(([moduleId, module], moduleIdx) => {
                const actions = module.actions;
                return (
                  <React.Fragment key={moduleId}>
                    {actions.map((action, actionIdx) => {
                      const key = `${moduleId}:${action.id}`;
                      const isGranted = currentRolePerms[key] === true;
                      
                      return (
                        <tr
                          key={key}
                          className={`border-b border-border hover:bg-muted/20 transition-colors ${
                            editMode && isGranted
                              ? "bg-emerald-50/30"
                              : editMode && !isGranted
                              ? "bg-red-50/20"
                              : ""
                          }`}
                        >
                          {actionIdx === 0 && (
                            <td
                              rowSpan={actions.length}
                              className="px-4 py-3 font-semibold text-foreground bg-muted/10 align-top border-r border-border"
                            >
                              <div className="flex items-center gap-2">
                                <span>{module.label}</span>
                                <Badge variant="outline" className="text-xs">
                                  {actions.length}
                                </Badge>
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-2 text-foreground">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{action.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{action.label}</span>
                                  {action.description && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs text-sm">
                                          {action.description}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                {action.sensitive && (
                                  <Badge className="mt-1 bg-rose-100 text-rose-700 border-0 text-xs">
                                    Confidencial
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {editMode ? (
                              <Checkbox
                                checked={isGranted}
                                onCheckedChange={() => handleToggle(key)}
                                className={`h-5 w-5 mx-auto ${
                                  isGranted
                                    ? "border-emerald-500 bg-emerald-50"
                                    : "border-slate-300"
                                }`}
                              />
                            ) : (
                              <div
                                className={`h-5 w-5 mx-auto rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                                  isGranted
                                    ? "bg-emerald-100 border-emerald-500 text-emerald-700"
                                    : "bg-slate-100 border-slate-400 text-slate-500"
                                }`}
                              >
                                {isGranted ? "✓" : "○"}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-4 flex items-center justify-between border-t border-border bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Total de permisos: <strong>{stats.granted}</strong> de {stats.total} otorgados
          </div>
          {editMode && (
            <Button
              onClick={() => onSave(activeRole)}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}