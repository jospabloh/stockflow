import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Save, X, RotateCcw, HelpCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PERMISSION_REGISTRY, getDefaultsForRole } from "@/lib/permissionRegistry";

// Re-export for backward compatibility
export const PERMISSION_MATRIX = PERMISSION_REGISTRY;

const ROLES = [
  { id: "admin", label: "Admin", color: "bg-purple-50 border-purple-200" },
  { id: "almacenista", label: "Almacenista", color: "bg-blue-50 border-blue-200" },
];

const CATEGORY_LABELS = {
  visual: "Visuales",
  actionable: "Accionables",
  report: "Reportes",
};

const CATEGORY_COLORS = {
  visual: "text-sky-700 bg-sky-50 border-sky-200",
  actionable: "text-amber-700 bg-amber-50 border-amber-200",
  report: "text-violet-700 bg-violet-50 border-violet-200",
};

export default function UnifiedPermissionMatrix({ perms, onPermChange, onSave, saving }) {
  const [editMode, setEditMode] = useState(false);
  const [activeRole, setActiveRole] = useState("admin");

  const getDefaultAlmacenista = () => getDefaultsForRole("almacenista");

  const currentRolePerms = activeRole === "almacenista" && (!perms?.[activeRole] || Object.keys(perms[activeRole]).length === 0)
    ? getDefaultAlmacenista()
    : (perms?.[activeRole] || {});

  const stats = useMemo(() => {
    const total = Object.values(PERMISSION_REGISTRY).reduce(
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
    if (!globalThis.confirm(`¿Restaurar permisos por defecto para ${activeRole}?`)) return;
    const defaults = getDefaultsForRole(activeRole);
    Object.keys(defaults).forEach(key => {
      onPermChange(activeRole, key, defaults[key]);
    });
  };

  const selectAll = () => {
    Object.entries(PERMISSION_REGISTRY).forEach(([module, data]) => {
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
                  className="bg-brand-600 hover:bg-brand-700"
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

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
          <span key={cat} className={`text-xs px-2 py-1 rounded border font-medium ${CATEGORY_COLORS[cat]}`}>
            {label}
          </span>
        ))}
        <span className="text-xs px-2 py-1 rounded border font-medium text-rose-700 bg-rose-50 border-rose-200">Confidencial</span>
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

      {/* Matriz agrupada por categoría */}
      <div className="space-y-8">
        {Object.entries(PERMISSION_REGISTRY).map(([moduleId, module]) => {
          const byCategory = { visual: [], actionable: [], report: [] };
          module.actions.forEach(action => {
            const cat = action.category || "actionable";
            byCategory[cat].push(action);
          });

          return (
            <Card key={moduleId} className="overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
                <span className="font-semibold text-foreground">{module.label}</span>
                <Badge variant="outline" className="text-xs">
                  {module.actions.length} acciones
                </Badge>
              </div>
              <div className="divide-y divide-border">
                {["visual", "actionable", "report"].map(cat => {
                  const actions = byCategory[cat];
                  if (actions.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wide ${CATEGORY_COLORS[cat]}`}>
                        {CATEGORY_LABELS[cat]}
                      </div>
                      <table className="w-full text-sm border-collapse">
                        <tbody>
                          {actions.map(action => {
                            const key = `${moduleId}:${action.id}`;
                            const isGranted = currentRolePerms[key] === true;
                            return (
                              <tr
                                key={key}
                                className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                                  editMode && isGranted
                                    ? "bg-emerald-50/30"
                                    : editMode && !isGranted
                                    ? "bg-red-50/20"
                                    : ""
                                }`}
                              >
                                <td className="px-4 py-2 text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{action.icon}</span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{action.label}</span>
                                        <span className="text-xs text-muted-foreground font-mono">{key}</span>
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
                                <td className="px-3 py-2 text-center w-16">
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
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="px-4 py-4 flex items-center justify-between border-t border-border bg-muted/20 rounded-lg">
        <div className="text-sm text-muted-foreground">
          Total de permisos: <strong>{stats.granted}</strong> de {stats.total} otorgados
        </div>
        {editMode && (
          <Button
            onClick={() => onSave(activeRole)}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        )}
      </div>
    </div>
  );
}
