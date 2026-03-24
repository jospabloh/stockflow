import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Search } from "lucide-react";

const SUGGESTIONS = [
  "¿Cómo creo una cotización?",
  "¿Cómo registro una entrada de inventario?",
  "¿Qué reportes puedo ver?",
  "¿Cómo cancelo una venta?",
];

export default function HelpSearchBot({ articles, onNavigate }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      onClick={() => setOpen(true)}
      className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-110 ${
        open ? "hidden" : ""
      }`}
      title="Asistente de Ayuda"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}