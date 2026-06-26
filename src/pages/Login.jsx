import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import SocialButtons from '@/components/auth/SocialButtons';
import { getRememberedIdentity, clearRememberedIdentity } from '@/lib/lastIdentity';

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Greet a returning user: prefill their email (cosmetic only — they still
  // enter the password; the remembered identity is never an auth credential).
  const [remembered, setRemembered] = useState(() => getRememberedIdentity());
  const [email, setEmail] = useState(remembered?.email || '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const useOtherAccount = () => {
    clearRememberedIdentity();
    setRemembered(null);
    setEmail('');
  };

  const from = location.state?.from?.pathname || '/';

  // Already signed in → don't show the login form.
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Sesión iniciada');
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error?.message || 'Correo o contraseña incorrectos');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Accede a tu cuenta de StockFlow"
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-500">
            Crea una
          </Link>
        </>
      }
    >
      {remembered && (remembered.name || remembered.email) && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {(remembered.name || remembered.email).trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">Bienvenido de nuevo{remembered.name ? `, ${remembered.name.split(' ')[0]}` : ''}</p>
            {remembered.email && <p className="truncate text-xs text-slate-500">{remembered.email}</p>}
          </div>
          <button type="button" onClick={useOtherAccount} className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-500">
            Usar otra cuenta
          </button>
        </div>
      )}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-brand-600 hover:text-brand-500"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Iniciar sesión
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">o</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <SocialButtons nextUrl={`${globalThis.location.origin}${from}`} />
    </AuthShell>
  );
};

export default Login;
