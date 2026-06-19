import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof globalThis !== "undefined" ? globalThis.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(globalThis.innerWidth < 768);
    globalThis.addEventListener("resize", handler);
    return () => globalThis.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

/**
 * MobileSelect — renders a bottom Sheet on mobile (<768px),
 * and the standard Radix Select on desktop.
 *
 * Props:
 *   value         — current value
 *   onValueChange — callback(value)
 *   placeholder   — shown when no value selected
 *   options       — [{ value: string, label: string }]
 *   disabled      — boolean
 *   triggerClassName — extra classes for the trigger button
 */
export function MobileSelect({
  value,
  onValueChange,
  placeholder = "Seleccionar",
  options = [],
  disabled = false,
  triggerClassName,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(true)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <Sheet open={open} onOpenChange={setOpen} modal={false}>
          <SheetContent
            side="bottom"
            className="max-h-[70vh] overflow-y-auto rounded-t-2xl pb-safe z-[200]"
          >
            <SheetHeader className="pb-2">
              <SheetTitle>{placeholder}</SheetTitle>
            </SheetHeader>
            <div className="space-y-1 pb-6">
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors",
                      isSelected
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: standard Radix Select
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}