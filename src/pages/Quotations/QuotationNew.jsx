import React from "react";
import { useNavigate } from "react-router-dom";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationNew() {
  const navigate = useNavigate();

  return (
    <QuotationFormDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) navigate('/Quotations', { replace: true });
      }}
      quotation={null}
      onSaved={() => {}}
    />
  );
}