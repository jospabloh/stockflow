import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SalesFilterToggle({ 
  period, 
  onPeriodChange, 
  startStr, 
  endStr,
  customDateRange,
  onCustomDateRangeChange
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [tempStart, setTempStart] = useState(customDateRange?.start || "");
  const [tempEnd, setTempEnd] = useState(customDateRange?.end || "");

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

  const applyCustomRange = () => {
    if (tempStart && tempEnd && tempStart <= tempEnd) {
      onCustomDateRangeChange({ start: tempStart, end: tempEnd });
      setShowCustom(false);
    }
  };

  const clearCustomRange = () => {
    setTempStart("");
    setTempEnd("");
    onCustomDateRangeChange({ start: null, end: null });
    setShowCustom(false);
  };

  const isCustomActive = customDateRange?.start && customDateRange?.end;
  const rangeLabel = startStr && endStr
    ? startStr === endStr
      ? formatDate(startStr)
      : `${formatDate(startStr)} – ${formatDate(endStr)}`
    : null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Calendar className="h-4 w-4 text-slate-500" />
        {periods.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={period === p.value && !isCustomActive ? "default" : "outline"}
            onClick={() => {
              onPeriodChange(p.value);
              clearCustomRange();
            }}
            className="text-xs"
          >
            {p.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={isCustomActive ? "default" : "outline"}
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs"
        >
          Personalizar
        </Button>
      </div>

      {showCustom && (
        <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
              className="h-8 text-xs"
            />
            <span className="text-slate-500">a</span>
            <Input
              type="date"
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={applyCustomRange}
            disabled={!tempStart || !tempEnd || tempStart > tempEnd}
            className="text-xs h-8"
          >
            Aplicar
          </Button>
          {isCustomActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearCustomRange}
              className="text-xs h-8"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {rangeLabel && (
        <span className={`text-xs font-medium ${isCustomActive ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded" : "text-indigo-600 dark:text-indigo-400"}`}>
          {rangeLabel}
        </span>
      )}
    </div>
  );
}