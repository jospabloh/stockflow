import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Search, ArrowRight, Loader2, Mail } from "lucide-react";
import { fuzzySearch } from "@/lib/fuzzySearch";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "¿Cómo creo una cotización?",
  "¿Cómo registro una entrada de inventario?",
  "¿Qué reportes puedo ver?",
  "¿Cómo cancelo una venta?",
];

export default function HelpSearchBot({ articles, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    if (!open) {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  const handleSearch = (q = query) => {
    if (!q.trim() || q.trim().length < 2) return;
    setLoading(true);
    // Simulación de delay para UX (el motor es síncrono)
    setTimeout(() => {
      const found = fuzzySearch(q, articles, 3);
      setResults(found);
      setSearched(true);
      setLoading(false);
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleSuggestion = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleNavigate = (id) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-110",
          open && "hidden"
        )}
        title="Asistente de Ayuda"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Search Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          style={{ maxHeight: "520px" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-white" />
              <div>
                <p className="text-white font-semibold text-sm">Asistente de Ayuda</p>
                <p className="text-indigo-200 text-xs">Búsqueda inteligente local</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
            {/* Welcome message */}
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🤖</span>
              </div>
              <div className="bg-slate-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-slate-600 max-w-[85%]">
                ¡Hola! Puedo ayudarte a encontrar información en el Centro de Ayuda. ¿Sobre qué tema tienes dudas?
              </div>
            </div>

            {/* Suggestions (before search) */}
            {!searched && !loading && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 pl-9">Preguntas frecuentes:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="w-full text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors ml-9"
                    style={{ width: "calc(100% - 36px)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex gap-2 items-center pl-9">
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400">Buscando...</span>
              </div>
            )}

            {/* User query bubble */}
            {searched && !loading && query && (
              <div className="flex gap-2 justify-end">
                <div className="bg-indigo-600 text-white rounded-xl rounded-tr-none px-3 py-2 text-sm max-w-[85%]">
                  {query}
                </div>
              </div>
            )}

            {/* Results */}
            {searched && !loading && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="flex-1 max-w-[85%]">
                  {results.length > 0 ? (
                    <div className="space-y-2">
                      <div className="bg-slate-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-slate-600">
                        Encontré {results.length} resultado{results.length > 1 ? "s" : ""} relevante{results.length > 1 ? "s" : ""}:
                      </div>
                      {results.map((art) => (
                        <button
                          key={art.id}
                          onClick={() => handleNavigate(art.id)}
                          className="w-full flex items-center gap-2 p-2.5 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50 transition-all text-left group"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">{art.title}</p>
                            <p className="text-xs text-slate-400">{art.category}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-slate-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-slate-600">
                        No encontré resultados para <strong>"{query}"</strong>. ¿Puedes intentar con otras palabras?
                      </div>
                      <a
                        href="mailto:soporte@acaciaco.com.mx"
                        className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors text-sm text-red-700 font-medium"
                      >
                        <Mail className="h-4 w-4" />
                        Contactar a Soporte
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (searched) setSearched(false); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={!query.trim() || query.trim().length < 2}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}