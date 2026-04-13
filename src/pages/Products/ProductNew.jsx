import React from "react";
import { useNavigate } from "react-router-dom";
import ProductFormDialog from "@/components/products/ProductFormDialog";

export default function ProductNew() {
  const navigate = useNavigate();

  const goBackToProducts = () => {
    navigate("/Products", { replace: true });
  };

  const handleSaved = (payload) => {
    if (payload?.success) {
      goBackToProducts();
    }
  };

  return (
    <ProductFormDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) goBackToProducts();
      }}
      product={null}
      onSaved={handleSaved}
    />
  );
}