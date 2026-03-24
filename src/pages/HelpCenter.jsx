import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { loadHelpData } from "@/lib/helpData";
import { fuzzySearch } from "@/lib/fuzzySearch";
import HelpSidebar from "@/components/help/HelpSidebar";
import HelpViewer from "@/components/help/HelpViewer";
import HelpSearchBot from "@/components/help/HelpSearchBot";
import { Search, X, BookOpen, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function HelpCenter() {
  const [articles, setArticles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const articleParam = params.get("article");
        const categoryParam = params.get("category");

        const data = await loadHelpData();
        const user = await base44.auth.me().catch(() => null);

        setArticles(data.articles || []);
        setUserRole(user?.role || null);

        if (articleParam) {
          setActiveId(articleParam);
        } else if (categoryParam) {
          const first = data.articles.find(a => a.category === categoryParam);
          if (first) setActiveId(first.id);
        } else {
          const role = user?.role;
          if (role === "admin") setActiveId("welcome-admin");
          else if (role === "almacenista") setActiveId("welcome-almacenista");
          else setActiveId("roles-overview");
        }
        setLoading(false);
      } catch (err) {
        console.error("Help Center Error:", err);
        setError("Error al cargar el Centro de Ayuda");
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      const results = fuzzySearch(q, articles, 8);
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    }
  };

  const handleSelect = (id) => {
    setActiveId(id);
    setSearchQuery("");
    setSearchResults(null);
    setSidebarOpen(false);
  };

  const activeArticle = articles.find(a => a.id === activeId);
  const displayArticles = searchResults !== null ? searchResults : articles;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-7xl mx-auto bg-card rounded-2xl shadow-sm border border-border overflow-hidden relative">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static top-0 left-0 h-full z-50 lg:z-auto
        w-72 bg-card border-r border-border flex flex-col flex-shrink-0
        transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar en la ayuda..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-8 text-sm h-9"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {searchResults !== null && (
            <p className="text-xs text-slate-400 mt-1.5 px-1">
              {searchResults.length === 0
                ? "Sin resultados"
                : `${searchResults.length} resultado${searchResults.length > 1 ? "s" : ""}`
              }
            </p>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <HelpSidebar
            articles={displayArticles}
            activeId={activeId}
            onSelect={handleSelect}
            userRole={userRole}
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-foreground text-sm">Centro de Ayuda</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {articles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">No hay artículos disponibles</p>
            </div>
          ) : (
            <HelpViewer
              article={activeArticle}
              allArticles={articles}
              onNavigate={handleSelect}
            />
          )}
        </div>
      </main>

      <HelpSearchBot articles={articles} onNavigate={handleSelect} />
    </div>
  );
}