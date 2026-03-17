import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Shield, Package, Users, ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_CONFIG = {
  admin: { label: "Solo Administradores", icon: Shield, cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800" },
  almacenista: { label: "Almacenistas", icon: Package, cls: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800" },
  all: { label: "Todos los roles", icon: Users, cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
};

const markdownComponents = {
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-8 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mt-5 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-slate-600 dark:text-slate-300 leading-relaxed my-2 text-sm">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1 pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 space-y-2 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm list-disc ml-2">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-800 dark:text-slate-100">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 dark:border-indigo-600 rounded-r-xl py-2 px-4 my-3 not-italic text-slate-700 dark:text-slate-300 text-sm">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    ) : (
      <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
    ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <table className="w-full border-collapse" style={{ minWidth: "100%" }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap border-r border-slate-200 dark:border-slate-700 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 text-sm border-r border-b border-slate-100 dark:border-slate-800 last:border-r-0 align-top leading-relaxed">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors even:bg-slate-50/50 dark:even:bg-slate-800/20">{children}</tr>
  ),
  hr: () => <hr className="my-6 border-slate-200 dark:border-slate-700" />,
};

export default function HelpViewer({ article, allArticles, onNavigate }) {
  if (!article) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-indigo-400" />
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
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 leading-tight">{article.title}</h1>

        {/* Content — Markdown with custom components */}
        <div>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{article.content}</ReactMarkdown>
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Temas Relacionados</p>
            <div className="grid gap-2">
              {relatedArticles.map(rel => (
                <button
                  key={rel.id}
                  onClick={() => onNavigate(rel.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all group text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">{rel.title.split(' ')[0]}</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 font-medium truncate">
                      {rel.title.replace(/^[^\s]+\s/, '')}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 flex-shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keywords */}
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-1.5">
            {article.keywords.map(kw => (
              <span key={kw} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}