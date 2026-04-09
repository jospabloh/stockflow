import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";

export default function QuotationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);

  useEffect(() => {
    base44.entities.Quotation.filter({ id }).then((results) => {
      if (results.length > 0) setQuotation(results[0]);
    });
  }, [id]);

  return (
    <QuotationFormDialog
      open={!!quotation}
      onOpenChange={(open) => {
        if (!open) navigate('/Quotations', { replace: true });
      }}
      quotation={quotation}
      onSaved={() => {}}
    />
  );
}