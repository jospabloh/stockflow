import React, { useState, useEffect } from "react";
import { localHelpData } from "@/lib/helpData";
import HelpSidebar from "@/components/help/HelpSidebar";

// Render inline markdown formatting
const renderInline = (text) => {
  let result = text;
  // Handle **bold** (must be before *italic*)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Handle *italic*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return result;
};

// Markdown parser
const MarkdownContent = ({ content }) => {
  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (/^[\-|=\s]+$/.test(trimmed)) {
      i++;
      continue;
    }
    
    if (line.startsWith('### ')) {
      const heading = line.slice(4);
      const formatted = renderInline(heading);
      elements.push(
        <h3 key={i} className="text-xl font-bold mt-5 mb-2" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else if (line.startsWith('## ')) {
      const heading = line.slice(3);
      const formatted = renderInline(heading);
      elements.push(
        <h2 key={i} className="text-2xl font-bold mt-6 mb-3" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else if (line.startsWith('# ')) {
      const heading = line.slice(2);
      const formatted = renderInline(heading);
      elements.push(
        <h1 key={i} className="text-3xl font-bold mt-8 mb-4" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto my-4 text-sm">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
    } else if (line.includes('|') && !trimmed.startsWith('|') === false) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|') && !/^[\-|=\s]+$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      
      const rows = tableLines.map(l => l.split('|').map(c => c.trim()).filter(c => c));
      if (rows.length > 0) {
        elements.push(
          <table key={i} className="w-full border-collapse border border-slate-300 my-4 text-sm">
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={idx === 0 ? 'bg-slate-100 border-b-2 border-slate-400 font-semibold' : ''}>
                  {row.map((cell, cidx) => (
                    <td key={cidx} className="border border-slate-300 px-3 py-2">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-indigo-400 pl-4 italic text-slate-600 my-3">
          {line.slice(2)}
        </blockquote>
      );
    } else if (trimmed) {
      const formatted = renderInline(trimmed);
      elements.push(
        <p key={i} className="my-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else {
      elements.push(<div key={i} className="my-1" />);
    }
    
    i++;
  }
  
  return <>{elements}</>;
};

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

  return (
    <div className="flex h-full bg-background">
      <HelpSidebar
        articles={articles}
        activeId={activeId}
        onSelectArticle={setActiveId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {activeArticle ? (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold mb-6">{activeArticle.title}</h1>
            <div className="text-slate-700 dark:text-slate-300">
              <MarkdownContent content={activeArticle.content} />
            </div>
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