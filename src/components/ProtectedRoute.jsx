import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { LicenseProvider } from '@/lib/LicenseContext';
import { PermissionProvider } from '@/lib/PermissionContext';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

/**
 * Guards the authenticated area of the app. Unauthenticated users are redirected
 * to the custom login page (remembering where they were headed). License and
 * permission providers are mounted here so they only run for signed-in users.
 */
const ProtectedRoute = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const location = useLocation();

  if (isLoadingAuth || isLoadingPublicSettings) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <LicenseProvider>
      <PermissionProvider>
        <Outlet />
      </PermissionProvider>
    </LicenseProvider>
  );
};

export default ProtectedRoute;
