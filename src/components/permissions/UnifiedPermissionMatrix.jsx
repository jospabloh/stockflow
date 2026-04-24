import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Save, X, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Matriz completa de funcionalidades por módulo
const PERMISSION_MATRIX = {
  Dashboard: {
    label: "Dashboard",
    actions: [
      { id: "view", label: "Ver página", icon: "👁️" },
      { id: "summary", label: "Tarjeta resumen", icon: "📊" },
      { id: "low_stock", label: "Alerta stock bajo", icon: "⚠️" },
      { id: "recent_movements", label: "Movimientos recientes", icon: "📈" },
      { id: "sales_report", label: "Reporte ventas", icon: "💰" },
      { id: "financial", label: "Resumen financiero", icon: "💵" },
    ]
  },
  Productos: {
    label: "Productos",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
      { id: "import", label: "Importar", icon: "📥" },
      { id: "barcode", label: "Generar códigos", icon: "📱" },
      { id: "cost_price", label: "Ver costo (confidencial)", icon: "💲", sensitive: true },
      { id: "wholesale", label: "Ver precios mayoreo", icon: "📦" },
    ]
  },
  Categorías: {
    label: "Categorías",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
    ]
  },
  Proveedores: {
    label: "Proveedores",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
    ]
  },
  Clientes: {
    label: "Clientes",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
      { id: "force_wholesale", label: "Precios mayoreo forzado", icon: "💲" },
      { id: "force_purchase", label: "Precios compra forzado", icon: "💲", sensitive: true },
    ]
  },
  "Tipo de Pago": {
    label: "Tipo de Pago",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
    ]
  },
  Movimientos: {
    label: "Movimientos",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear movimiento", icon: "➕" },
      { id: "entry", label: "Entrada de stock", icon: "⬆️" },
      { id: "exit", label: "Salida de stock", icon: "⬇️" },
      { id: "return", label: "Devolución", icon: "↩️" },
      { id: "adjustment", label: "Ajuste de inventario", icon: "⚙️" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
      { id: "confirm_payment", label: "Confirmar pago", icon: "✓" },
    ]
  },
  Cotizaciones: {
    label: "Cotizaciones",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
      { id: "convert", label: "Convertir a venta", icon: "✓" },
      { id: "cancel", label: "Cancelar", icon: "❌" },
      { id: "return", label: "Procesar devolución", icon: "↩️" },
      { id: "pricing", label: "Ver detalles precio", icon: "💲", sensitive: true },
      { id: "send", label: "Enviar cotización", icon: "📧" },
      { id: "export", label: "Exportar PDF", icon: "📄" },
    ]
  },
  "Caja Chica": {
    label: "Caja Chica",
    actions: [
      { id: "view", label: "Ver saldo", icon: "👁️" },
      { id: "view_history", label: "Ver historial", icon: "📋" },
      { id: "add_fund", label: "Agregar fondo", icon: "➕" },
      { id: "expense", label: "Registrar egreso", icon: "➖" },
      { id: "income", label: "Registrar ingreso", icon: "⬆️" },
      { id: "edit", label: "Editar movimiento", icon: "✏️" },
      { id: "delete", label: "Eliminar movimiento", icon: "🗑️" },
    ]
  },
  "Pagos a Proveedores": {
    label: "Pagos a Proveedores",
    actions: [
      { id: "view", label: "Ver lista", icon: "👁️" },
      { id: "create", label: "Crear pago", icon: "➕" },
      { id: "edit", label: "Editar", icon: "✏️" },
      { id: "delete", label: "Eliminar", icon: "🗑️" },
    ]
  },
  Reportes: {
    label: "Reportes",
    actions: [
      { id: "view", label: "Ver reportes", icon: "👁️" },
      { id: "operational", label: "Reportes operacionales", icon: "📊" },
      { id: "predictive", label: "Reportes predictivos", icon: "🔮" },
      { id: "export", label: "Exportar datos", icon: "📥" },
    ]
  },
  Configuración: {
    label: "Configuración",
    actions: [
      { id: "view", label: "Ver configuración", icon: "⚙️" },
      { id: "business", label: "Datos negocio", icon: "🏢" },
      { id: "app_settings", label: "Configuración app", icon: "🎨" },
      { id: "import_products", label: "Importar productos", icon: "📥" },
      { id: "manage_clients", label: "Gestionar clientes", icon: "👥" },
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
  const currentRolePerms = perms?.[activeRole] || {};

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
      : {}; // Almacenista por defecto sin permisos
    
    Object.keys(defaults).forEach(key => {
      onPermChange(activeRole, key, defaults[key]);
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
            {ROLES.map(role => (
              <TabsTrigger key={role.id} value={role.id}>
                <span>{role.label}</span>
                <Badge variant="outline" className="ml-2 h-5 px-1.5 text-xs">
                  {Object.keys(currentRolePerms).filter(k => currentRolePerms[k] === true).length}/{stats.total}
                </Badge>
              </TabsTrigger>
            ))}
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

      {/* Reset button */}
      {editMode && (
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
          className="text-amber-700 border-amber-300 hover:bg-amber-50"
        >
          <RotateCcw className="h-4 w-4 mr-1" /> Restaurar valores por defecto
        </Button>
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
                              <div>
                                <div className="font-medium">{action.label}</div>
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