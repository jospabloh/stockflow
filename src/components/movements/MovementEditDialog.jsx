import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";

export default function MovementEditDialog({ open, onOpenChange, movement, onSaved }) {
  const { businessId } = useBusinessContext();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [clients, setClients] = useState([]);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && businessId) {
      Promise.all([
        base44.entities.PaymentMethod.filter({ business_id: businessId, active: true }),
        base44.entities.Client.filter({ business_id: businessId, status: "active" }),
      ]).then(([pms, cls]) => {
        setPaymentMethods(pms);
        setClients(cls);
      });
      setReference(movement?.reference || "");
      setReason(movement?.reason || "");
    }
  }, [open, movement, businessId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await base44.functions.invoke('updateMovementPaymentDetailsSafe', { movement_id: movement.id, reference, reason });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'No se pudo actualizar el movimiento');
      }
      toast.success("Movimiento actualizado");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Movimiento</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Solo se pueden editar datos informativos. Para cambios de inventario o dinero, elimina y crea un nuevo movimiento.
        </p>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="mb-1.5 block">Forma de pago</Label>
            <SearchableSelect
              value={reference}
              onValueChange={setReference}
              placeholder="Seleccionar forma de pago"
              options={paymentMethods.map((pm) => ({ value: pm.name, label: pm.name }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Cliente</Label>
            <SearchableSelect
              value={reason}
              onValueChange={setReason}
              placeholder="Seleccionar cliente"
              options={clients.map((c) => ({
                value: c.business_name || c.name,
                label: c.business_name || c.name,
                searchLabel: `${c.business_name || ""} ${c.name || ""}`.trim(),
              }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}