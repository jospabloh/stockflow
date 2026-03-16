import React, { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen, Shield, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_BADGE = {
  admin: { label: "Admin", cls: "bg-indigo-100 text-indigo-700" },
  almacenista: { label: "Almacenista", cls: "bg-cyan-100 text-cyan-700" },
  all: null,
};

export default function HelpSidebar({ articles, activeId, onSelect, userRole }) {
  // Agrupar por categoría
  const grouped = articles.reduce((acc, art) => {
    if (!acc[art.category]) acc[art.category] = [];
    acc[art.category].push(art);
    return acc;
  }, {});

  // Detectar categoría activa para abrirla por defecto
  const activeArticle = articles.find(a => a.id === activeId);
  const [openCats, setOpenCats] = useState(() => {
    const initial = {};
    if (activeArticle) initial[activeArticle.category] = true;
    else if (Object.keys(grouped)[0]) initial[Object.keys(grouped)[0]] = true;
    return initial;
  });

  const toggleCat = (cat) => {
    setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Filtrar artículos por rol si se especifica
  const filterArticle = (art) => {
    if (!userRole) return true;
    return art.role === "all" || art.role === userRole;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold text-slate-700 text-sm">Centro de Ayuda</span>
        </div>
        {userRole && (
          <div className="mt-2 flex items-center gap-1.5">
            {userRole === "admin"
              ? <Shield className="h-3 w-3 text-indigo-500" />
              : <Package className="h-3 w-3 text-cyan-500" />
            }
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              userRole === "admin" ? "bg-indigo-50 text-indigo-600" : "bg-cyan-50 text-cyan-600"
            )}>
              {userRole === "admin" ? "Administrador" : "Almacenista"}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {Object.entries(grouped).map(([category, catArticles]) => {
          const visibleArticles = catArticles.filter(filterArticle);
          if (visibleArticles.length === 0) return null;
          const isOpen = openCats[category];

          return (
            <div key={category}>
              {/* Category header */}
              <button
                onClick={() => toggleCat(category)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors group"
              >
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">
                  {category}
                </span>
                {isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                }
              </button>

              {/* Articles list */}
              {isOpen && (
                <div className="pb-1">
                  {visibleArticles.map(art => {
                    const isActive = art.id === activeId;
                    const badge = ROLE_BADGE[art.role];
                    return (
                      <button
                        key={art.id}
                        onClick={() => onSelect(art.id)}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm transition-all border-l-2 flex items-start gap-2",
                          isActive
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                            : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                        )}
                      >
                        <span className="flex-1 leading-snug">{art.title}</span>
                        {badge && !userRole && (
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5", badge.cls)}>
                            {badge.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}