import { useState } from 'react';
import { MonitorSmartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SessionBanner({ onReactivate }) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleReactivate = async () => {
    setLoading(true);
    await onReactivate();
    setLoading(false);
  };

  return (
    <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="bg-amber-50 border border-amber-300 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-xl w-full pointer-events-auto">
        <MonitorSmartphone className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          Tu sesión está activa en otro dispositivo. ¿Retomar aquí?
        </p>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs"
          onClick={handleReactivate}
          disabled={loading}
        >
          {loading ? 'Activando...' : 'Retomar'}
        </Button>
        <button type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}