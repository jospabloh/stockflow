import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);

  useEffect(() => {
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
  }, [id]);

  const goBackToQuotations = () => {
    navigate("/Quotations", { replace: true });
  };

  const handleSaved = (payload) => {
    if (payload?.success) {
      goBackToQuotations();
    }
  };

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