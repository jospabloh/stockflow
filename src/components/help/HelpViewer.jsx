import React from "react";
import ReactMarkdown from "react-markdown";
import { Shield, Package, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_CONFIG = {
  admin: { label: "Solo Administradores", icon: Shield, cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  almacenista: { label: "Almacenistas", icon: Package, cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  all: { label: "Todos los roles", icon: Users, cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

export default function HelpViewer({ article, allArticles, onNavigate }) {
  if (!article) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto">
            <span className="text-3xl">📖</span>
          </div>
          <p className="text-slate-500 text-sm">Selecciona un tema del menú lateral</p>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_CONFIG[article.role] || ROLE_CONFIG.all;
  const RoleIcon = roleInfo.icon;

  const relatedArticles = (article.related_ids || [])
    .map(rid => allArticles.find(a => a.id === rid))
    .filter(Boolean);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Role badge */}
        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium mb-4", roleInfo.cls)}>
          <RoleIcon className="h-3 w-3" />
          {roleInfo.label}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-800 mb-6 leading-tight">{article.title}</h1>

        {/* Content — Markdown */}
        <div className="prose prose-slate prose-sm max-w-none
          prose-h2:text-lg prose-h2:font-bold prose-h2:text-slate-800 prose-h2:mt-6 prose-h2:mb-3
          prose-h3:text-base prose-h3:font-semibold prose-h3:text-slate-700 prose-h3:mt-4 prose-h3:mb-2
          prose-p:text-slate-600 prose-p:leading-relaxed prose-p:my-2
          prose-ul:my-2 prose-ul:space-y-1
          prose-li:text-slate-600 prose-li:leading-relaxed
          prose-strong:text-slate-800 prose-strong:font-semibold
          prose-blockquote:border-l-indigo-400 prose-blockquote:bg-indigo-50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic
          prose-blockquote:text-slate-700
          prose-code:bg-slate-100 prose-code:text-indigo-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
          prose-table:text-sm prose-th:text-slate-700 prose-th:font-semibold prose-td:text-slate-600
          prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
        ">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-10 pt-6 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Temas Relacionados</p>
            <div className="space-y-2">
              {relatedArticles.map(rel => (
                <button
                  key={rel.id}
                  onClick={() => onNavigate(rel.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group text-left"
                >
                  <span className="text-sm text-slate-700 group-hover:text-indigo-700 font-medium">{rel.title}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keywords (hidden visually, for SEO/search context) */}
        <div className="mt-8 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap gap-1.5">
            {article.keywords.map(kw => (
              <span key={kw} className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}