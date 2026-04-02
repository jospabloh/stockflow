import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Download, AlertCircle } from "lucide-react";

const CURRENT_VERSION = "1.0.0";
const DISMISS_KEY = "app_update_banner_dismissed_version";
const LAST_CHECK_KEY = "app_update_last_check";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

export default function AppUpdateBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const [autoHideTimeout, setAutoHideTimeout] = useState(null);
  const checkIntervalRef = useRef(null);

  const checkForUpdates = async () => {
    try {
      const versions = await base44.entities.AppVersion.list("-created_date", 1);
      if (versions.length === 0) return;

      const latestVersion = versions[0].version;
      if (latestVersion !== CURRENT_VERSION) {
        const dismissedVersion = localStorage.getItem(DISMISS_KEY);
        if (dismissedVersion !== latestVersion) {
          setNewVersion(latestVersion);
          setIsVisible(true);
          // Auto-hide después de 5 segundos
          const timeout = setTimeout(() => {
            setIsVisible(false);
          }, 5000);
          setAutoHideTimeout(timeout);
        }
      }
    } catch (error) {
      // Silenciosamente falla si no hay conexión
    }
  };

  useEffect(() => {
    // Verificar al montar el componente
    checkForUpdates();

    // Configurar verificación periódica
    checkIntervalRef.current = setInterval(() => {
      checkForUpdates();
    }, CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (autoHideTimeout) clearTimeout(autoHideTimeout);
    };
  }, []);

  const handleDismiss = () => {
    if (newVersion) {
      localStorage.setItem(DISMISS_KEY, newVersion);
    }
    setIsVisible(false);
    if (autoHideTimeout) clearTimeout(autoHideTimeout);
  };

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {isVisible && newVersion && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-[999] bg-gradient-to-r from-indigo-500 to-cyan-500 dark:from-indigo-600 dark:to-cyan-600 shadow-lg"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Download className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-xs sm:text-sm font-semibold truncate">
                  Nueva versión {newVersion} disponible
                </p>
                <p className="text-indigo-100 text-[11px] sm:text-xs truncate">
                  Se cerrará automáticamente en 5 segundos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUpdate}
                className="h-8 px-3 text-white hover:bg-white/20 text-xs sm:text-sm font-medium"
              >
                Actualizar
              </Button>
              <button
                onClick={handleDismiss}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/20 transition-colors text-white flex-shrink-0"
                aria-label="Descartar notificación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}