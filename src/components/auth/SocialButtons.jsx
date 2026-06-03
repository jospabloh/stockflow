import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

// Provider metadata. We only render a button when the provider is enabled in the
// app's auth config. When the config is not available we fall back to Google,
// which is the most common default for Base44 apps.
const PROVIDERS = [
  { key: 'google', label: 'Continuar con Google', flag: 'enable_google_login' },
  { key: 'microsoft', label: 'Continuar con Microsoft', flag: 'enable_microsoft_login' },
  { key: 'facebook', label: 'Continuar con Facebook', flag: 'enable_facebook_login' },
  { key: 'apple', label: 'Continuar con Apple', flag: 'enable_apple_login' },
];

/**
 * Renders the OAuth provider buttons enabled for this app. `nextUrl` is where the
 * user lands after a successful login.
 */
const SocialButtons = ({ nextUrl = `${globalThis.location.origin}/` }) => {
  const { authConfig, loginWithProvider } = useAuth();

  const enabled = authConfig
    ? PROVIDERS.filter((p) => authConfig[p.flag])
    : PROVIDERS.filter((p) => p.key === 'google');

  if (enabled.length === 0) return null;

  return (
    <div className="space-y-3">
      {enabled.map((p) => (
        <Button
          key={p.key}
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => loginWithProvider(p.key, nextUrl)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
};

export default SocialButtons;
