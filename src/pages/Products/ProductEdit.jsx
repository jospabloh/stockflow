import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductFormDialog from "@/components/products/ProductFormDialog";

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    base44.entities.Product.filter({ id }).then((results) => {
      if (results.length > 0) setProduct(results[0]);
    });
  }, [id]);

  const handleSaved = (payload) => {
    if (!payload || payload._reconcile) {
      navigate(-1);
    }
  };

  return (
    <ProductFormDialog
      open={!!product}
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
      product={product}
      onSaved={handleSaved}
    />
  );
}