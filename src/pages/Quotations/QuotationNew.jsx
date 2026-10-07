import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePermissions } from "@/lib/PermissionContext";
import { Spinner } from "@/components/ui/spinner";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationNew() {
  const navigate = useNavigate();
  const { can, loading: permissionsLoading } = usePermissions();

  const goBackToQuotations = () => {
    navigate("/Quotations", { replace: true });
  };

  useEffect(() => {
    // No decidir mientras los permisos cargan: el rol aún es null y can() daría false.
    if (permissionsLoading) return;
    if (!can('Cotizaciones', 'create')) {
      toast.error("No tienes permiso para crear cotizaciones.");
      goBackToQuotations();
    }
  }, [permissionsLoading]);

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
      open
      onOpenChange={(open) => {
        if (!open) goBackToQuotations();
      }}
      quotation={null}
      onSaved={handleSaved}
    />
  );
}