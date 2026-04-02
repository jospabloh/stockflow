import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function SalesFilterToggle({ period, onPeriodChange }) {
  const periods = [
    { value: "day", label: "Día" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "year", label: "Año" },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="h-4 w-4 text-slate-500" />
      {periods.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={period === p.value ? "default" : "outline"}
          onClick={() => onPeriodChange(p.value)}
          className="text-xs"
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}