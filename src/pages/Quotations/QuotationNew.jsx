import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePermissions } from "@/lib/PermissionContext";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationNew() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const goBackToQuotations = () => {
    navigate("/Quotations", { replace: true });
  };

  useEffect(() => {
    if (!can('Cotizaciones', 'create')) {
      toast.error("No tienes permiso para crear cotizaciones.");
      goBackToQuotations();
    }
  }, []);

  const handleSaved = (payload) => {
    if (payload?.success) {
      goBackToQuotations();
    }
  };

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