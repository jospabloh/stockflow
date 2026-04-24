import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Edit2, Save, X } from "lucide-react";
import { ARTIFACTS, LEGACY_DEFAULTS } from "@/lib/permissionArtifacts";

const ACTION_LABELS = {
  ver: "Ver",
  leer: "Leer",
  escribir: "Escribir",
  modificar: "Modificar",
  eliminar: "Eliminar",
};

const ACTION_COLORS = {
  ver: "bg-blue-50 border-blue-200",
  leer: "bg-cyan-50 border-cyan-200",
  escribir: "bg-green-50 border-green-200",
  modificar: "bg-amber-50 border-amber-200",
  eliminar: "bg-red-50 border-red-200",
};

export default function AlmacenistaReviewPanel({ perms, onPermChange, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const defaultPerms = LEGACY_DEFAULTS.almacenista;

  // Get artifacts grouped by their visibility
  const visibleArtifacts = ARTIFACTS.filter(a => defaultPerms[a.key]?.ver);
  const hiddenArtifacts = ARTIFACTS.filter(a => !defaultPerms[a.key]?.ver);

  const handleToggle = (artifact, action) => {
    if (!editMode) return;
    const current = perms?.almacenista?.[artifact]?.[action] ?? false;
    onPermChange('almacenista', artifact, action, !current);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Revisión de Permisos: Almacenista</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {editMode ? "Modo edición - Ajusta los permisos según sea necesario" : "Modo vista - Haz clic en Editar para cambiar"}
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

      {/* Visible sections */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-slate-600 flex items-center gap-2">
          <Eye className="h-4 w-4" /> Secciones Visibles ({visibleArtifacts.length})
        </h4>
        <div className="grid gap-3">
          {visibleArtifacts.map(artifact => {
            const defaultActions = defaultPerms[artifact.key];
            const currentActions = perms?.almacenista?.[artifact.key] || {};
            
            return (
              <Card key={artifact.key} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{artifact.label}</p>
                    <p className="text-xs text-muted-foreground">{artifact.key}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Visible
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {['ver', 'leer', 'escribir', 'modificar', 'eliminar'].map(action => {
                    const isDefault = defaultActions[action];
                    const isCurrent = currentActions[action] ?? isDefault;
                    const isChanged = isCurrent !== isDefault;
                    
                    return (
                      <div
                        key={action}
                        className={`p-2 rounded border-2 transition-colors ${ACTION_COLORS[action]} ${
                          editMode ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => handleToggle(artifact.key, action)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isCurrent}
                            disabled={!editMode}
                            onCheckedChange={() => handleToggle(artifact.key, action)}
                          />
                          <label className="text-xs font-medium cursor-pointer flex-1">
                            {ACTION_LABELS[action]}
                          </label>
                        </div>
                        {isChanged && editMode && (
                          <p className="text-[10px] text-amber-600 mt-1">
                            {isDefault ? '↓ Reducido' : '↑ Ampliado'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Hidden sections */}
      {hiddenArtifacts.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-slate-500 flex items-center gap-2">
            <EyeOff className="h-4 w-4" /> Secciones Ocultas ({hiddenArtifacts.length})
          </h4>
          <Card className="p-4 bg-slate-50">
            <p className="text-sm text-slate-600">
              {hiddenArtifacts.map(a => a.label).join(", ")}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}