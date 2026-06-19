import { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tiempo que muestra el countdown (debe coincidir con IDLE_LOGOUT_MS del hook = 2 min)
const COUNTDOWN_SEC = 2 * 60;

export default function IdleWarningDialog({ open, onContinue }) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SEC);

  useEffect(() => {
    if (!open) {
      setSeconds(COUNTDOWN_SEC);
      return;
    }
    setSeconds(COUNTDOWN_SEC);
    const interval = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">¿Sigues ahí?</h3>
            <p className="text-sm text-muted-foreground">No hemos detectado actividad en un rato.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          La sesión se cerrará en{' '}
          <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{timeStr}</span>{' '}
          por inactividad.
        </p>

        <Button
          className="w-full bg-brand-600 hover:bg-brand-700 text-white gap-2"
          onClick={onContinue}
        >
          <RefreshCw className="h-4 w-4" />
          Seguir trabajando
        </Button>
      </div>
    </div>
  );
}