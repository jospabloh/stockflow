import React from "react";
import { useNavigate } from "react-router-dom";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationNew() {
  const navigate = useNavigate();

  const handleSaved = (payload) => {
    if (!payload || payload._reconcile) {
      navigate(-1);
    }
  };

  return (
    <QuotationFormDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
      quotation={null}
      onSaved={handleSaved}
    />
  );
}