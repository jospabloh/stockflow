import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from "@/api/base44Client";
import { MessageCircle, X, Send, Minimize2, Maximize2, GripVertical, Paperclip, Mic, MicOff, ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MessageBubble from './MessageBubble';

const AGENT_NAME = 'helpAssistant';

export default function FloatingHelpChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [position, setPosition] = useState({ x: null, y: null });
    const [dragging, setDragging] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]); // { url, name, type }
    const [isRecording, setIsRecording] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const chatRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const unsubscribeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Set default position bottom-right on mount
    useEffect(() => {
        setPosition({
            x: globalThis.innerWidth - 380,
            y: globalThis.innerHeight - 520
        });
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Subscribe to conversation updates
    const subscribeToConversation = useCallback((conv) => {
        if (unsubscribeRef.current) unsubscribeRef.current();
        const unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
            setMessages(data.messages || []);
        });
        unsubscribeRef.current = unsub;
    }, []);

    // Create or load conversation when opened
    useEffect(() => {
        if (!isOpen) return;
        if (conversation) return;

        const init = async () => {
            setLoading(true);
            try {
                const conv = await base44.agents.createConversation({
                    agent_name: AGENT_NAME,
                    metadata: { name: 'Ayuda StockFlow' }
                });
                setConversation(conv);
                setMessages(conv.messages || []);
                subscribeToConversation(conv);
            } catch (e) {
                console.error('Error al iniciar asistente:', e);
            } finally {
                setLoading(false);
            }
        };
        init();

        return () => {
            if (unsubscribeRef.current) unsubscribeRef.current();
        };
    }, [isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && !isMinimized) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, isMinimized]);

    // Auto-resize textarea
    const autoResize = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }, []);

    const handleSend = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || !conversation || sending) return;
        const text = input.trim();
        const files = attachedFiles.map(f => f.url);
        setInput('');
        setAttachedFiles([]);
        if (inputRef.current) inputRef.current.style.height = 'auto';
        setSending(true);
        try {
            const msg = { role: 'user', content: text || '📎 Archivo adjunto' };
            if (files.length > 0) msg.file_urls = files;
            await base44.agents.addMessage(conversation, msg);
        } catch (e) {
            console.error('Error al enviar mensaje:', e);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploadingFile(true);
        try {
            const uploaded = await Promise.all(files.map(async (file) => {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                return { url: file_url, name: file.name, type: file.type };
            }));
            setAttachedFiles(prev => [...prev, ...uploaded]);
        } catch (e) {
            console.error('Error al subir archivo:', e);
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const removeAttachedFile = (idx) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleMicToggle = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
                setUploadingFile(true);
                try {
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    setAttachedFiles(prev => [...prev, { url: file_url, name: 'Audio grabado', type: 'audio/webm' }]);
                } catch (err) {
                    console.error('Error al subir audio:', err);
                } finally {
                    setUploadingFile(false);
                }
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error('No se pudo acceder al micrófono:', e);
        }
    };

    // Drag logic
    const handleDragStart = useCallback((e) => {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragOffset.current = {
            x: clientX - position.x,
            y: clientY - position.y
        };
        setDragging(true);
    }, [position]);

    const handleDragMove = useCallback((e) => {
        if (!dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const chatW = chatRef.current?.offsetWidth || 360;
        const chatH = chatRef.current?.offsetHeight || 480;
        const newX = Math.max(0, Math.min(globalThis.innerWidth - chatW, clientX - dragOffset.current.x));
        const newY = Math.max(0, Math.min(globalThis.innerHeight - chatH, clientY - dragOffset.current.y));
        setPosition({ x: newX, y: newY });
    }, [dragging]);

    const handleDragEnd = useCallback(() => {
        setDragging(false);
    }, []);

    useEffect(() => {
        if (dragging) {
            globalThis.addEventListener('mousemove', handleDragMove);
            globalThis.addEventListener('mouseup', handleDragEnd);
            globalThis.addEventListener('touchmove', handleDragMove, { passive: false });
            globalThis.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            globalThis.removeEventListener('mousemove', handleDragMove);
            globalThis.removeEventListener('mouseup', handleDragEnd);
            globalThis.removeEventListener('touchmove', handleDragMove);
            globalThis.removeEventListener('touchend', handleDragEnd);
        };
    }, [dragging, handleDragMove, handleDragEnd]);

    const isTyping = messages.length > 0 &&
        messages[messages.length - 1]?.role === 'user' && sending;

    // Floating button (closed state)
    if (!isOpen) {
        return (
            <button type="button"
                onClick={() => setIsOpen(true)}
                className={cn(
                    "fixed z-[100] w-14 h-14 rounded-full shadow-2xl",
                    "bg-brand-500 hover:bg-brand-600 text-white",
                    "flex items-center justify-center transition-all duration-200",
                    "hover:scale-110 active:scale-95"
                )}
                // Sits directly above the corner theme switcher (40px circle at
                // --theme-switcher-bottom/right) instead of on top of it: below
                // `lg` the switcher is lifted over the tab bar, which used to put
                // the two controls on the same spot.
                style={{
                    right: 'calc(var(--theme-switcher-right, 1rem) + env(safe-area-inset-right, 0px) - 0.5rem)',
                    bottom: 'calc(var(--theme-switcher-bottom, 1rem) + env(safe-area-inset-bottom, 0px) + 3.25rem)',
                }}
                aria-label="Abrir asistente de ayuda"
            >
                <MessageCircle className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-400 rounded-full border-2 border-white" />
            </button>
        );
    }

    return (
        <div
            ref={chatRef}
            className={cn(
                "fixed z-[100] flex flex-col rounded-2xl shadow-2xl border border-border",
                "bg-card transition-all duration-200",
                dragging ? "cursor-grabbing select-none" : "",
                isMinimized ? "h-14" : "h-[480px]"
            )}
            style={{
                left: position.x,
                top: position.y,
                width: 360,
                maxWidth: '95vw',
            }}
        >
            {/* Header — drag handle */}
            <div
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-t-2xl border-b border-border",
                    "bg-brand-500 text-white cursor-grab active:cursor-grabbing",
                    isMinimized && "rounded-b-2xl border-b-0"
                )}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <GripVertical className="h-4 w-4 opacity-60 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">Asistente StockFlow</p>
                    <p className="text-xs opacity-75 leading-tight">¿En qué te ayudo?</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white hover:bg-white/20 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                    aria-label={isMinimized ? "Maximizar" : "Minimizar"}
                >
                    {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white hover:bg-white/20 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    aria-label="Cerrar"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Body */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {loading && (
                            <div className="flex justify-center items-center h-full">
                                <Loader />
                            </div>
                        )}

                        {!loading && messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                                <div className="h-12 w-12 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                    <span className="text-2xl">✦</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Asistente de StockFlow</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Pregúntame sobre cotizaciones, pagos, inventario, productos y más.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1.5 w-full mt-1">
                                    {[
                                        "¿Cómo registro un pago parcial?",
                                        "¿Cómo convierto una cotización en venta?",
                                        "¿Qué cotizaciones están pendientes de pago?"
                                    ].map((q) => (
                                        <button type="button"
                                            key={q}
                                            onClick={() => setInput(q)}
                                            className="text-xs text-left px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!loading && messages.map((msg, i) => (
                            <MessageBubble key={i} message={msg} />
                        ))}

                        {sending && (
                            <div className="flex gap-2 justify-start">
                                <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs">✦</span>
                                </div>
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2">
                                    <div className="flex gap-1 items-center h-4">
                                        <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-border">
                        {/* Attached files preview */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {attachedFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700 rounded-lg px-2 py-1 text-xs text-brand-700 dark:text-brand-300 max-w-[140px]">
                                        {f.type.startsWith('image/') ? <ImageIcon className="h-3 w-3 flex-shrink-0" /> : <Mic className="h-3 w-3 flex-shrink-0" />}
                                        <span className="truncate">{f.name}</span>
                                        <button type="button" onClick={() => removeAttachedFile(i)} className="ml-0.5 text-brand-400 hover:text-red-500 flex-shrink-0">×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-1.5 items-end">
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            {/* Image attach button */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl flex-shrink-0 text-muted-foreground hover:text-brand-500"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingFile || sending}
                                aria-label="Adjuntar imagen"
                                title="Adjuntar imagen"
                            >
                                {uploadingFile ? (
                                    <div className="h-4 w-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Paperclip className="h-4 w-4" />
                                )}
                            </Button>
                            {/* Mic button */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn("h-9 w-9 rounded-xl flex-shrink-0", isRecording ? "text-red-500 animate-pulse" : "text-muted-foreground hover:text-brand-500")}
                                onClick={handleMicToggle}
                                disabled={uploadingFile || sending}
                                aria-label={isRecording ? "Detener grabación" : "Grabar audio"}
                                title={isRecording ? "Detener grabación" : "Grabar audio"}
                            >
                                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Escribe tu pregunta..."
                                rows={1}
                                className={cn(
                                    "flex-1 resize-none rounded-xl border border-input bg-background",
                                    "px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-brand-500",
                                    "overflow-y-auto"
                                )}
                                style={{ minHeight: 38, maxHeight: 120 }}
                            />
                            <Button
                                size="icon"
                                className="h-9 w-9 rounded-xl bg-brand-500 hover:bg-brand-600 flex-shrink-0"
                                onClick={handleSend}
                                disabled={(!input.trim() && attachedFiles.length === 0) || sending || !conversation}
                                aria-label="Enviar mensaje"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                            Enter para enviar · Shift+Enter para nueva línea
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

function Loader() {
    return (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Iniciando asistente...</p>
        </div>
    );
}
