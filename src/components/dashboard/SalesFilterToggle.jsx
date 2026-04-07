import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function SalesFilterToggle({ period, onPeriodChange, startStr, endStr }) {
  const periods = [
    { value: "day", label: "Día" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "year", label: "Año" },
  ];

  const formatDate = (str) => {
    if (!str) return "";
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  };

  const rangeLabel = startStr && endStr
    ? startStr === endStr
      ? formatDate(startStr)
      : `${formatDate(startStr)} – ${formatDate(endStr)}`
    : null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2 flex-wrap justify-end">
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
      {rangeLabel && (
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          {rangeLabel}
        </span>
      )}
    </div>
  );
}