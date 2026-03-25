import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BarcodeCameraScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const detectedRef = useRef(false); // prevent multiple fires
  const [error, setError] = useState(null);

  useEffect(() => {
    detectedRef.current = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (result && !detectedRef.current) {
        detectedRef.current = true;
        onDetected(result.getText());
      }
    }).catch(() => {
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
    });

    return () => {
      try { readerRef.current?.reset(); } catch {}
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <Camera className="h-5 w-5 text-indigo-500" />
            Escanear código de barras
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error ? (
          <div className="p-6 text-center text-red-500 text-sm">{error}</div>
        ) : (
          <div className="relative">
            <video ref={videoRef} className="w-full min-h-[260px] object-cover bg-black" autoPlay muted playsInline />
            {/* Guía visual */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-emerald-400 rounded-lg w-2/3 h-24 opacity-80" />
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400 text-center py-3 px-4">
          Apunta la cámara al código de barras para escanearlo automáticamente
        </p>
      </div>
    </div>
  );
}