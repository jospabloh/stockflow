import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect — dropdown con búsqueda en tiempo real.
 * Props:
 *   value: string (id/valor seleccionado)
 *   onValueChange: (value) => void
 *   options: Array<{ value: string, label: string }>
 *   placeholder: string
 *   clearable: boolean (default true)
 *   className: string
 */
export default function SearchableSelect({ value, onValueChange, options = [], placeholder = "Seleccionar...", clearable = true, className }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => o.value === value) || null;

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (option) => {
    onValueChange(option.value);
    setQuery("");
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onValueChange("");
    setQuery("");
    setOpen(false);
  };

  const handleTriggerClick = () => {
    setOpen(prev => !prev);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger / selected display */}
      <div
        onClick={handleTriggerClick}
        className={cn(
          "flex items-center justify-between w-full min-h-9 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm cursor-pointer",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
          open && "ring-2 ring-ring ring-offset-1 ring-offset-background"
        )}
      >
        {open ? (
          <div className="flex items-center flex-1 gap-2" onClick={e => e.stopPropagation()}>
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={selected ? selected.label : placeholder}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              onClick={e => { e.stopPropagation(); setOpen(true); }}
            />
          </div>
        ) : (
          <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {clearable && selected && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            filtered.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors",
                  option.value === value && "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                )}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}