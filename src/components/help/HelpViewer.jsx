import React from "react";
import ReactMarkdown from "react-markdown";
import { ArrowRight } from "lucide-react";

export default function HelpViewer({ article, allArticles, onNavigate }) {
  if (!article) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500">Selecciona un tema</p>
      </div>
    );
  }

  const relatedArticles = (article.related_ids || [])
    .map(rid => allArticles.find(a => a.id === rid))
    .filter(Boolean);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">{article.title}</h1>

        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>

        {relatedArticles.length > 0 && (
          <div className="mt-10 pt-6 border-t">
            <p className="text-xs font-bold text-slate-400 uppercase mb-3">Temas Relacionados</p>
            <div className="grid gap-2">
              {relatedArticles.map(rel => (
                <button type="button"
                  key={rel.id}
                  onClick={() => onNavigate(rel.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group text-left"
                >
                  <span className="font-medium text-sm group-hover:text-brand-600">{rel.title}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
