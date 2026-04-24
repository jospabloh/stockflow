import { usePermissions } from '../lib/PermissionContext';

export function PermissionGate({ artifact, action = 'leer', children, fallback = null }) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(artifact, action)) return fallback;
  return children;
}
