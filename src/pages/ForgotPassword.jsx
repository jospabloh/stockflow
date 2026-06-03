import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import AuthShell from '@/components/auth/AuthShell';

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar el correo de recuperación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle={sent ? undefined : 'Te enviaremos un enlace para restablecerla'}
      footer={
        <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <MailCheck className="h-7 w-7 text-green-600" />
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Si existe una cuenta con <span className="font-medium text-slate-900">{email}</span>,
            recibirás un correo con instrucciones para restablecer tu contraseña.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar enlace de recuperación
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
