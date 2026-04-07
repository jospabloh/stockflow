import React from "react";
import { useNavigate } from "react-router-dom";
import MovementFormDialog from "@/components/movements/MovementFormDialog";

export default function MovementNew() {
  const navigate = useNavigate();

  const handleSaved = (payload) => {
    if (!payload || payload._reconcile) {
      navigate(-1);
    }
  };

  return (
    <MovementFormDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
      onSaved={handleSaved}
    />
  );
}