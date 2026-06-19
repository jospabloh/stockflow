import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import AuthShell from '@/components/auth/AuthShell';

const ResetPassword = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The reset email may use any of these query param names for the token.
  const resetToken =
    searchParams.get('resetToken') ||
    searchParams.get('reset_token') ||
    searchParams.get('token') ||
    '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ resetToken, newPassword: password });
      toast.success('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error?.message || 'No se pudo restablecer la contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Restablecer contraseña"
      subtitle="Elige una nueva contraseña para tu cuenta"
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-500">
          Volver a iniciar sesión
        </Link>
      }
    >
      {!resetToken ? (
        <p className="text-center text-sm text-slate-600">
          El enlace de restablecimiento no es válido o ha expirado. Solicita uno nuevo desde{' '}
          <Link to="/forgot-password" className="font-semibold text-brand-600 hover:text-brand-500">
            recuperar contraseña
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Restablecer contraseña
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
