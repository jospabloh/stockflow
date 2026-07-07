import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import AuthLayout from '@/components/AuthLayout';
import GoogleIcon from '@/components/GoogleIcon';
import { getRememberedIdentity, clearRememberedIdentity } from '@/lib/lastIdentity';

const Login = () => {
  const { login, loginWithProvider, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [remembered, setRemembered] = useState(() => getRememberedIdentity());
  const [email, setEmail] = useState(remembered?.email || '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  if (isAuthenticated) return <Navigate to={from} replace />;

  const useOtherAccount = () => {
    clearRememberedIdentity();
    setRemembered(null);
    setEmail('');
  };

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

  const nextUrl = `${globalThis.location.origin}${from}`;
  const firstName = remembered?.name?.split(' ')[0];

  return (
    <AuthLayout
      icon={LogIn}
      title="Bienvenido a StockFlow"
      subtitle="Accede a tu cuenta para continuar"
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-500">
            Regístrate
          </Link>
        </>
      }
    >
      {/* One-tap returning user card */}
      {remembered && (remembered.name || remembered.email) && (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            {remembered.avatar ? (
              <img src={remembered.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {(remembered.name || remembered.email).trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {remembered.name && <p className="truncate text-sm font-semibold text-foreground">{remembered.name}</p>}
              {remembered.email && <p className="truncate text-xs text-muted-foreground">{remembered.email}</p>}
            </div>
            <GoogleIcon className="h-5 w-5 shrink-0" />
          </div>
          <Button
            type="button"
            className="mt-3 h-10 w-full"
            onClick={() => loginWithProvider('google', nextUrl)}
          >
            Continuar como {firstName || remembered.email}
          </Button>
          <button
            type="button"
            onClick={useOtherAccount}
            className="mt-2 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Usar otra cuenta
          </button>
        </div>
      )}

      {/* Google OAuth button */}
      {!remembered && (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-2.5"
            onClick={() => loginWithProvider('google', nextUrl)}
          >
            <GoogleIcon className="h-5 w-5" />
            Continuar con Google
          </Button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {/* Email / password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="h-12 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-500">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 pl-9"
            />
          </div>
        </div>

        <Button type="submit" className="h-12 w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Iniciar sesión
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Login;