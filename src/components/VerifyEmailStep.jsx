import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';

// El registro manda un código por correo; sin este paso la cuenta nunca queda
// verificada y el login responde "Please verify your email".
export const needsEmailVerification = (error) =>
  /verify your email|verification code/i.test(error?.message || '');

export default function VerifyEmailStep({ email, password, onVerified, onCancel }) {
  const { verifyOtp, resendOtp, login } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await verifyOtp(email, code.trim());
    } catch (error) {
      toast.error(error?.message || 'Código inválido o vencido');
      setBusy(false);
      return;
    }
    try {
      await login(email, password);
      toast.success('Correo verificado');
      onVerified();
    } catch {
      toast.success('Correo verificado. Inicia sesión.');
      onVerified({ needsLogin: true });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendOtp(email);
      toast.success('Te enviamos un código nuevo');
    } catch (error) {
      toast.error(error?.message || 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enviamos un código a <strong className="text-foreground">{email}</strong>. Escríbelo para
        activar tu cuenta.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="otp">Código de verificación</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="h-12 pl-9 tracking-widest"
          />
        </div>
      </div>
      <Button type="submit" className="h-12 w-full" disabled={busy || !code.trim()}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Verificar
      </Button>
      <div className="flex justify-between text-xs font-medium">
        <button type="button" onClick={handleResend} disabled={resending} className="text-brand-600 hover:text-brand-500">
          {resending ? 'Enviando…' : 'Reenviar código'}
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          Usar otro correo
        </button>
      </div>
    </form>
  );
}
