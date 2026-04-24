import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Edit2, Save, X, AlertCircle } from "lucide-react";
import { ARTIFACTS, LEGACY_DEFAULTS } from "@/lib/permissionArtifacts";

const ACTION_LABELS = {
  ver: "Ver",
  leer: "Leer",
  escribir: "Escribir",
  modificar: "Modificar",
  eliminar: "Eliminar",
};

const ACTION_ICONS = {
  ver: "👁️",
  leer: "📖",
  escribir: "✏️",
  modificar: "🔧",
  eliminar: "🗑️",
};

export default function AlmacenistaReviewPanel({ perms, onPermChange, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const defaultPerms = LEGACY_DEFAULTS.almacenista;

  // Get artifacts grouped by their visibility
  const visibleArtifacts = ARTIFACTS.filter(a => defaultPerms[a.key]?.ver);
  const hiddenArtifacts = ARTIFACTS.filter(a => !defaultPerms[a.key]?.ver);

  const handlePermissionChange = (artifact, action, shouldAllow) => {
    if (!editMode) return;
    const defaultValue = defaultPerms[artifact][action];
    
    // Solo permitir reducir (desactivar), nunca ampliar más del default
    if (shouldAllow && !defaultValue) {
      return; // No se puede permitir un permiso que no está permitido por default
    }
    
    onPermChange('almacenista', artifact, action, shouldAllow);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Permisos: Almacenista</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {editMode 
              ? "Modo edición - Solo puedes reducir permisos (no ampliarlos más del default)" 
              : "Modo vista - Los permisos están en rojo si están reducidos"}
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

      {/* Info alert */}
      <Card className="p-3 bg-blue-50 border-blue-200 flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Los permisos en <strong>verde</strong> son los permitidos por defecto. Los en <strong>rojo</strong> están reducidos. 
          {editMode && " En modo edición, puedes desactivar permisos pero no otorgar más de lo permitido."}
        </p>
      </Card>

      {/* Visible sections */}
      <div className="space-y-3">
        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
          <Eye className="h-4 w-4" /> Secciones Visibles ({visibleArtifacts.length})
        </h4>
        <div className="grid gap-4">
          {visibleArtifacts.map(artifact => {
            const defaultActions = defaultPerms[artifact.key];
            const currentActions = perms?.almacenista?.[artifact.key] || {};
            const hasChanges = Object.keys(defaultActions).some(
              action => (currentActions[action] ?? defaultActions[action]) !== defaultActions[action]
            );
            
            return (
              <Card key={artifact.key} className={`p-4 transition-colors ${hasChanges && editMode ? 'border-amber-300 bg-amber-50' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-foreground">{artifact.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{artifact.key}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Visible
                    </Badge>
                    {hasChanges && (
                      <Badge className="bg-amber-100 text-amber-800 border-0">
                        Modificado
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Permission toggles with impact explanation */}
                <div className="space-y-2">
                  {['ver', 'leer', 'escribir', 'modificar', 'eliminar'].map(action => {
                    const isDefault = defaultActions[action];
                    const isCurrent = currentActions[action] ?? isDefault;
                    const isReduced = !isCurrent && isDefault;
                    
                    // Impact messages
                    const impactMap = {
                      ver: "No puede acceder a esta sección",
                      leer: "No puede ver detalles de registros",
                      escribir: "No puede crear registros nuevos",
                      modificar: "No puede editar registros existentes",
                      eliminar: "No puede eliminar registros"
                    };
                    
                    return (
                      <div
                        key={action}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isReduced 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-emerald-50 border-emerald-300'
                        } ${editMode && isDefault ? 'cursor-pointer hover:shadow-sm' : ''}`}
                        onClick={() => {
                          if (editMode && isDefault) {
                            handlePermissionChange(artifact.key, action, !isCurrent);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-lg mt-0.5">{ACTION_ICONS[action]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{ACTION_LABELS[action]}</div>
                            <div className={`text-xs mt-1 ${isReduced ? 'text-red-700 font-semibold' : 'text-emerald-700'}`}>
                              {isReduced ? `✗ ${impactMap[action]}` : `✓ Permitido`}
                            </div>
                          </div>
                          {editMode && isDefault && (
                            <Checkbox
                              checked={isCurrent}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(artifact.key, action, checked)
                              }
                              className="w-5 h-5 flex-shrink-0 mt-0.5"
                            />
                          )}
                          {!editMode && isDefault && (
                            <div className={`text-lg font-bold ${isCurrent ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isCurrent ? '✓' : '✗'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Summary - only show reduced permissions with impact */}
                {(() => {
                  const reduced = ['ver', 'leer', 'escribir', 'modificar', 'eliminar'].filter(action => {
                    const isDefault = defaultActions[action];
                    const isCurrent = currentActions[action] ?? isDefault;
                    return !isCurrent && isDefault;
                  });
                  
                  const impactMap = {
                    ver: "No puede acceder a esta sección",
                    leer: "No puede ver detalles",
                    escribir: "No puede crear registros",
                    modificar: "No puede editar",
                    eliminar: "No puede eliminar"
                  };
                  
                  return reduced.length > 0 && (
                    <div className="mt-4 p-3 bg-red-100/60 border border-red-300 rounded-lg">
                      <p className="text-xs font-semibold text-red-900 mb-2">Lo que está BLOQUEADO:</p>
                      <ul className="space-y-1">
                        {reduced.map(action => (
                          <li key={action} className="text-xs text-red-800 flex gap-2 items-start">
                            <span className="font-bold flex-shrink-0">✗</span>
                            <span>{impactMap[action]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Hidden sections */}
      {hiddenArtifacts.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-500 flex items-center gap-2">
            <EyeOff className="h-4 w-4" /> Secciones Ocultas ({hiddenArtifacts.length})
          </h4>
          <Card className="p-4 bg-slate-50 border-slate-200">
            <div className="flex gap-2 flex-wrap">
              {hiddenArtifacts.map(a => (
                <Badge key={a.key} variant="outline" className="bg-slate-100 text-slate-600">
                  {a.label}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}