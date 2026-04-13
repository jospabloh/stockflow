import React from "react";
import { useNavigate } from "react-router-dom";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationNew() {
  const navigate = useNavigate();

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
      open={true}
      onOpenChange={(open) => {
        if (!open) goBackToQuotations();
      }}
      quotation={null}
      onSaved={handleSaved}
    />
  );
}