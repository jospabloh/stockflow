import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect — dropdown con búsqueda en tiempo real.
 * Props:
 *   value: string (id/valor seleccionado)
 *   onValueChange: (value) => void
 *   options: Array<{ value: string, label: string, searchLabel?: string }>
 *     - label: texto que se muestra al seleccionar
 *     - searchLabel: texto que se usa para buscar Y mostrar en el resultado (si difiere de label)
 *   placeholder: string
 *   clearable: boolean (default true)
 *   className: string
 */
export default function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Seleccionar...",
  clearable = true,
  className,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;

  // OB6: busca en label Y searchLabel (nombre negocio), muestra searchLabel si existe
  const filtered = query.trim()
    ? options.filter((o) => {
        const haystack = ((o.searchLabel || o.label) + " " + (o.label || "")).toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
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

  // OB1 FIX: abrir siempre al hacer clic, y forzar focus al input
  const handleTriggerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      // doble RAF para garantizar que el input ya está en el DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleTriggerClick(e);
          if (e.key === "Escape") { setOpen(false); setQuery(""); }
        }}
        onClick={handleTriggerClick}
        className={cn(
          "flex items-center justify-between w-full min-h-9 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm cursor-pointer select-none",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
          open && "ring-2 ring-ring ring-offset-1 ring-offset-background"
        )}
      >
        {open ? (
          <div
            className="flex items-center flex-1 gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selected ? (selected.searchLabel || selected.label) : placeholder}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setQuery(""); }
                e.stopPropagation();
              }}
            />
          </div>
        ) : (
          <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? (selected.searchLabel || selected.label) : placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {clearable && selected && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Dropdown — fixed z-index alto para no quedar bajo el Dialog */}
      {open && (
        <div
          role="listbox"
          className="absolute z-[200] w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // evita blur antes del click
                  handleSelect(option);
                }}
                className={cn(
                  "w-full px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors",
                  option.value === value &&
                    "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                )}
              >
                {/* OB6: mostrar searchLabel (nombre negocio) prominente si existe */}
                {option.searchLabel ? (
                  <span>
                    <span className="font-medium">{option.searchLabel}</span>
                    <span className="text-muted-foreground text-xs ml-1">— {option.label}</span>
                  </span>
                ) : (
                  option.label
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}