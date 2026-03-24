import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { loadHelpData } from "@/lib/helpData";
import { fuzzySearch } from "@/lib/fuzzySearch";
import HelpSidebar from "@/components/help/HelpSidebar";
import HelpViewer from "@/components/help/HelpViewer";
import HelpSearchBot from "@/components/help/HelpSearchBot";
import { Search, X, Menu } from "lucide-react";
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

  useEffect(() => {
    (async () => {
      try {
        const data = await loadHelpData();
        const user = await base44.auth.me().catch(() => null);

        const arts = data.articles || [];
        setArticles(arts);
        setUserRole(user?.role);

        const params = new URLSearchParams(window.location.search);
        const articleParam = params.get("article");
        
        let initialId = null;
        if (articleParam) {
          initialId = articleParam;
        } else {
          const role = user?.role;
          if (role === "admin") {
            initialId = "welcome-admin";
          } else if (role === "almacenista") {
            initialId = "welcome-almacenista";
          } else {
            initialId = "roles-overview";
          }
        }
        
        setActiveId(initialId);
        setLoading(false);
      } catch (err) {
        console.error("Help error:", err);
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const results = fuzzySearch(q, articles, 8);
    setSearchResults(results);
  };

  const handleSelect = (id) => {
    setActiveId(id);
    setSearchQuery("");
    setSearchResults(null);
    setSidebarOpen(false);
  };

  const activeArticle = articles.find(a => a.id === activeId);
  const displayArticles = searchResults !== null ? searchResults : articles;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0 bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 h-full z-50 lg:z-auto w-72 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-8 text-sm h-9"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {articles.length === 0 ? (
            <p className="p-4 text-slate-400">No hay artículos</p>
          ) : (
            <HelpSidebar
              articles={displayArticles}
              activeId={activeId}
              onSelect={handleSelect}
              userRole={userRole}
            />
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="lg:hidden p-4 border-b border-border flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Ayuda</h1>
        </div>

        <div className="flex-1 overflow-auto">
          {articles.length > 0 && activeArticle ? (
            <HelpViewer article={activeArticle} allArticles={articles} onNavigate={handleSelect} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Cargando contenido...</p>
            </div>
          )}
        </div>
      </main>

      {articles.length > 0 && <HelpSearchBot articles={articles} onNavigate={handleSelect} />}
    </div>
  );
}