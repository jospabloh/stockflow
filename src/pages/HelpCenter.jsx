import React, { useState, useEffect, Suspense, lazy } from "react";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { localHelpData } from "@/lib/helpData";

// Lazy load markdown to avoid module issues
const ReactMarkdown = lazy(() => import("react-markdown"));

export default function HelpCenter() {
  const [articles, setArticles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    try {
      const arts = (localHelpData && localHelpData.articles) || [];
      setArticles(arts);
      if (arts.length > 0) {
        setActiveId(arts[0].id);
      }
    } catch (err) {
      console.error("Error loading help data:", err);
    }
  }, []);

  const activeArticle = articles.find(a => a.id === activeId);

  const filtered = articles.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.keywords?.some(k => k.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-full gap-0 bg-background">
      {/* Sidebar */}
      <aside className="w-72 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm h-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map(article => (
              <button
                key={article.id}
                onClick={() => setActiveId(article.id)}
                className={`w-full text-left px-4 py-2 text-sm border-l-2 transition-all ${
                  activeId === article.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                    : "border-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="line-clamp-2">{article.title}</div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-slate-400">
              No hay resultados
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {activeArticle ? (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold mb-6">{activeArticle.title}</h1>
            <Suspense fallback={<div className="h-8 w-8 animate-spin border-4 border-indigo-200 border-t-indigo-600 rounded-full" />}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{activeArticle.content}</ReactMarkdown>
              </div>
            </Suspense>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Selecciona un tema</p>
          </div>
        )}
      </main>
    </div>
  );
}