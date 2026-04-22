import { useState } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function SessionExpiredDialog({ open }) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleContinue = async () => {
    setLoading(true);
    try {
      // Intentar re-autenticar redirigiendo al login y volviendo a la misma página
      base44.auth.redirectToLogin(window.location.pathname + window.location.search);
    } catch {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Tu sesión está por expirar</h3>
            <p className="text-sm text-muted-foreground">Por seguridad, necesitas volver a iniciar sesión para continuar trabajando.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          No te preocupes — todo lo que guardaste está a salvo. Solo necesitas renovar tu sesión.
        </p>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            onClick={handleContinue}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Redirigiendo...' : 'Seguir trabajando'}
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
}