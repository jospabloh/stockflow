import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { usePermissions } from "@/lib/PermissionContext";
import { Spinner } from "@/components/ui/spinner";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, loading: permissionsLoading } = usePermissions();
  const [quotation, setQuotation] = useState(null);

  useEffect(() => {
    // No decidir mientras los permisos cargan: el rol aún es null y can() daría false.
    // Sin id (instancia saliente durante la transición de salida) no hay nada que decidir ni pedir.
    if (permissionsLoading || !id) return;
    if (!can('Cotizaciones', 'edit_items')) {
      toast.error("No tienes permiso para editar cotizaciones.");
      navigate("/Quotations", { replace: true });
      return;
    }
    base44.entities.Quotation.filter({ id })
      .then((results) => {
        if (results.length > 0) {
          setQuotation(results[0]);
        } else {
          toast.error("No se encontró la cotización. Puede haber sido eliminada.");
          navigate("/Quotations", { replace: true });
        }
      })
      .catch(() => {
        toast.error("No se pudo cargar la cotización. Verifica tu conexión e intenta nuevamente.");
        navigate("/Quotations", { replace: true });
      });
  }, [id, permissionsLoading]);

  const goBackToQuotations = () => {
    navigate("/Quotations", { replace: true });
  };

  const handleSaved = (payload) => {
    if (payload?.success) {
      goBackToQuotations();
    }
  };

  if (permissionsLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <QuotationFormDialog
      open={!!quotation}
      onOpenChange={(open) => {
        if (!open) goBackToQuotations();
      }}
      quotation={quotation}
      onSaved={handleSaved}
    />
  );
}