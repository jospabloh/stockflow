import React, { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function HelpSidebar({ articles, activeId, onSelectArticle, searchQuery, onSearchChange }) {
  const [expandedCategories, setExpandedCategories] = useState({});

  // Group articles by category
  const grouped = useMemo(() => {
    const groups = {};
    articles.forEach(article => {
      if (!groups[article.category]) {
        groups[article.category] = [];
      }
      groups[article.category].push(article);
    });
    return groups;
  }, [articles]);

  // Filter articles based on search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    
    const q = searchQuery.toLowerCase();
    const result = {};
    
    Object.entries(grouped).forEach(([category, items]) => {
      const matches = items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.keywords?.some(k => k.toLowerCase().includes(q))
      );
      if (matches.length > 0) {
        result[category] = matches;
      }
    });
    
    return result;
  }, [grouped, searchQuery]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const categories = Object.keys(filtered).sort();

  return (
    <aside className="w-72 bg-card border-r border-border flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-border sticky top-0 bg-card/95 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {categories.length > 0 ? (
          categories.map(category => (
            <div key={category} className="border-b border-border/50">
              {/* Category Header */}
              <button type="button"
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted text-sm font-medium text-foreground transition-colors"
              >
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{
                    transform: expandedCategories[category] ? "rotate(0)" : "rotate(-90deg)"
                  }}
                />
                {category}
                <span className="ml-auto text-xs text-muted-foreground">
                  {filtered[category].length}
                </span>
              </button>

              {/* Articles */}
              {expandedCategories[category] && (
                <div className="bg-muted/30">
                  {filtered[category].map(article => (
                    <button type="button"
                      key={article.id}
                      onClick={() => onSelectArticle(article.id)}
                      className={`w-full text-left px-6 py-2.5 text-sm border-l-2 transition-all ${
                        activeId === article.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium"
                          : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-muted/50"
                      }`}
                    >
                      <div className="line-clamp-2">{article.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-slate-400">
            No hay resultados
          </div>
        )}
      </div>
    </aside>
  );
}