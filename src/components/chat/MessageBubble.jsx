import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FunctionDisplay = ({ toolCall }) => {
    const [expanded, setExpanded] = useState(false);
    const name = toolCall?.name || 'Herramienta';
    const status = toolCall?.status || 'pending';
    const results = toolCall?.results;

    const parsedResults = (() => {
        if (!results) return null;
        try { return typeof results === 'string' ? JSON.parse(results) : results; }
        catch { return results; }
    })();

    const isError = results && (
        (typeof results === 'string' && /error|failed/i.test(results)) ||
        (parsedResults?.success === false)
    );

    const statusConfig = {
        pending: { icon: Clock, color: 'text-slate-400', text: 'Pendiente' },
        running: { icon: Loader2, color: 'text-slate-500', text: 'Consultando...', spin: true },
        in_progress: { icon: Loader2, color: 'text-slate-500', text: 'Consultando...', spin: true },
        completed: isError
            ? { icon: AlertCircle, color: 'text-red-500', text: 'Error' }
            : { icon: CheckCircle2, color: 'text-green-600', text: 'Listo' },
        success: { icon: CheckCircle2, color: 'text-green-600', text: 'Listo' },
        failed: { icon: AlertCircle, color: 'text-red-500', text: 'Error' },
        error: { icon: AlertCircle, color: 'text-red-500', text: 'Error' }
    }[status] || { icon: Zap, color: 'text-slate-500', text: '' };

    const Icon = statusConfig.icon;
    const formattedName = name.replace(/_/g, ' ').toLowerCase();

    return (
        <div className="mt-1 text-xs">
            <button type="button"
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all",
                    "hover:bg-slate-50 dark:hover:bg-slate-800",
                    expanded ? "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                )}
            >
                <Icon className={cn("h-3 w-3", statusConfig.color, statusConfig.spin && "animate-spin")} />
                <span className="text-slate-600 dark:text-slate-400">{formattedName}</span>
                {statusConfig.text && (
                    <span className={cn("text-slate-400", isError && "text-red-500")}>• {statusConfig.text}</span>
                )}
                {!statusConfig.spin && parsedResults && (
                    <ChevronRight className={cn("h-3 w-3 text-slate-400 ml-auto transition-transform", expanded && "rotate-90")} />
                )}
            </button>
        </div>
    );
};

export default function MessageBubble({ message }) {
    const isUser = message.role === 'user';

    return (
        <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
                <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-xs">✦</span>
                </div>
            )}
            <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
                {message.content && (
                    <div className={cn(
                        "rounded-2xl px-3 py-2",
                        isUser
                            ? "bg-indigo-500 text-white"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    )}>
                        {isUser ? (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                        ) : (
                            <ReactMarkdown
                                className="text-sm prose prose-sm prose-slate dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                components={{
                                    code: ({ inline, className, children, ...props }) => {
                                        return inline ? (
                                            <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs">
                                                {children}
                                            </code>
                                        ) : (
                                            <pre className="bg-slate-900 text-slate-100 rounded-lg p-2 overflow-x-auto my-1">
                                                <code {...props}>{children}</code>
                                            </pre>
                                        );
                                    },
                                    p: ({ children }) => <p className="my-1 leading-relaxed text-foreground">{children}</p>,
                                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc text-foreground">{children}</ul>,
                                    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal text-foreground">{children}</ol>,
                                    li: ({ children }) => <li className="my-0.5 text-foreground">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                    h1: ({ children }) => <h1 className="text-base font-semibold my-1 text-foreground">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-sm font-semibold my-1 text-foreground">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-semibold my-1 text-foreground">{children}</h3>,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
                {message.tool_calls?.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                        {message.tool_calls.map((toolCall, idx) => (
                            <FunctionDisplay key={idx} toolCall={toolCall} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}