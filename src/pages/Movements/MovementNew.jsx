import React from "react";
import { useNavigate } from "react-router-dom";
import MovementFormDialog from "@/components/movements/MovementFormDialog";

export default function MovementNew() {
  const navigate = useNavigate();

  const goBackToMovements = () => {
    navigate("/Movements", { replace: true });
  };

  const handleSaved = (payload) => {
    if (payload?.success) {
      goBackToMovements();
    }
  };

  return (
    <MovementFormDialog
      open
      onOpenChange={(open) => {
        if (!open) goBackToMovements();
      }}
      onSaved={handleSaved}
    />
  );
}