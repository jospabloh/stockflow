import React from "react";
import { useNavigate } from "react-router-dom";
import ProductFormDialog from "@/components/products/ProductFormDialog";

export default function ProductNew() {
  const navigate = useNavigate();

  const handleSaved = (payload) => {
    if (!payload || payload._reconcile) {
      navigate(-1);
    }
  };

  return (
    <ProductFormDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
      product={null}
      onSaved={handleSaved}
    />
  );
}