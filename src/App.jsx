import React, { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
const PublicQuotation = lazy(() => import('./pages/PublicQuotation'));
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { BusinessProvider } from '@/components/BusinessContext';
const LicenseAdmin = lazy(() => import('./pages/LicenseAdmin'));
const TenantRulesAdmin = lazy(() => import('./pages/TenantRulesAdmin'));
const PermissionAdmin = lazy(() => import('./pages/PermissionAdmin'));
import { NavigationProvider } from '@/lib/NavigationContext';

import BusinessSetup from './pages/BusinessSetup';

const SuperAdminLogs = lazy(() => import('./pages/SuperAdminLogs'));

const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const About = lazy(() => import('./pages/About'));
const ProductNew = lazy(() => import('./pages/Products/ProductNew'));
const ProductEdit = lazy(() => import('./pages/Products/ProductEdit'));
const MovementNew = lazy(() => import('./pages/Movements/MovementNew'));
const QuotationNew = lazy(() => import('./pages/Quotations/QuotationNew'));
const QuotationEdit = lazy(() => import('./pages/Quotations/QuotationEdit'));
const PettyCash = lazy(() => import('./pages/PettyCash'));
const BarcodeGenerator = lazy(() => import('./pages/BarcodeGenerator'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Clients = lazy(() => import('./pages/Clients'));
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'));
const SupplierPayments = lazy(() => import('./pages/SupplierPayments'));
const Utility = lazy(() => import('./pages/Utility'));
const Rubros = lazy(() => import('./pages/Rubros'));
const FundAccounts = lazy(() => import('./pages/FundAccounts'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : null;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const location = useLocation();
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (location.pathname.startsWith('/q/')) {
    return (
      <Routes>
        <Route path="/q/:token" element={<Suspense fallback={<PageLoader />}><PublicQuotation /></Suspense>} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors. `auth_required` is no longer auto-redirected to
  // the hosted login — the in-app /login page (via ProtectedRoute) handles it.
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Public custom-auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated area — everything below requires a signed-in user */}
      <Route element={<ProtectedRoute />}>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/BusinessSetup" element={<BusinessSetup />} />
      <Route path="/HelpCenter" element={<LayoutWrapper currentPageName="HelpCenter"><Suspense fallback={<PageLoader />}><HelpCenter /></Suspense></LayoutWrapper>} />
      <Route path="/About" element={<LayoutWrapper currentPageName="About"><Suspense fallback={<PageLoader />}><About /></Suspense></LayoutWrapper>} />
      <Route path="/Products/new" element={<LayoutWrapper currentPageName="Products"><Suspense fallback={<PageLoader />}><ProductNew /></Suspense></LayoutWrapper>} />
      <Route path="/Products/edit/:id" element={<LayoutWrapper currentPageName="Products"><Suspense fallback={<PageLoader />}><ProductEdit /></Suspense></LayoutWrapper>} />
      <Route path="/Movements/new" element={<LayoutWrapper currentPageName="Movements"><Suspense fallback={<PageLoader />}><MovementNew /></Suspense></LayoutWrapper>} />
      <Route path="/Quotations/new" element={<LayoutWrapper currentPageName="Quotations"><Suspense fallback={<PageLoader />}><QuotationNew /></Suspense></LayoutWrapper>} />
      <Route path="/Quotations/edit/:id" element={<LayoutWrapper currentPageName="Quotations"><Suspense fallback={<PageLoader />}><QuotationEdit /></Suspense></LayoutWrapper>} />
      <Route path="/PettyCash" element={<LayoutWrapper currentPageName="PettyCash"><Suspense fallback={<PageLoader />}><PettyCash /></Suspense></LayoutWrapper>} />
      <Route path="/BarcodeGenerator" element={<LayoutWrapper currentPageName="Products"><Suspense fallback={<PageLoader />}><BarcodeGenerator /></Suspense></LayoutWrapper>} />
      <Route path="/Categories" element={<LayoutWrapper currentPageName="Categories"><Suspense fallback={<PageLoader />}><Categories /></Suspense></LayoutWrapper>} />
      <Route path="/Suppliers" element={<LayoutWrapper currentPageName="Suppliers"><Suspense fallback={<PageLoader />}><Suppliers /></Suspense></LayoutWrapper>} />
      <Route path="/Clients" element={<LayoutWrapper currentPageName="Clients"><Suspense fallback={<PageLoader />}><Clients /></Suspense></LayoutWrapper>} />
      <Route path="/PaymentMethods" element={<LayoutWrapper currentPageName="PaymentMethods"><Suspense fallback={<PageLoader />}><PaymentMethods /></Suspense></LayoutWrapper>} />
      <Route path="/SupplierPayments" element={<LayoutWrapper currentPageName="SupplierPayments"><Suspense fallback={<PageLoader />}><SupplierPayments /></Suspense></LayoutWrapper>} />
      <Route path="/Utility" element={<LayoutWrapper currentPageName="Utility"><Suspense fallback={<PageLoader />}><Utility /></Suspense></LayoutWrapper>} />
      <Route path="/Rubros" element={<LayoutWrapper currentPageName="Rubros"><Suspense fallback={<PageLoader />}><Rubros /></Suspense></LayoutWrapper>} />
      <Route path="/FundAccounts" element={<LayoutWrapper currentPageName="FundAccounts"><Suspense fallback={<PageLoader />}><FundAccounts /></Suspense></LayoutWrapper>} />
      <Route path="/LicenseAdmin" element={<LayoutWrapper currentPageName="LicenseAdmin"><Suspense fallback={<PageLoader />}><LicenseAdmin /></Suspense></LayoutWrapper>} />
      <Route path="/TenantRulesAdmin" element={<LayoutWrapper currentPageName="TenantRulesAdmin"><Suspense fallback={<PageLoader />}><TenantRulesAdmin /></Suspense></LayoutWrapper>} />
      <Route path="/PermissionAdmin" element={<LayoutWrapper currentPageName="PermissionAdmin"><Suspense fallback={<PageLoader />}><PermissionAdmin /></Suspense></LayoutWrapper>} />
      <Route path="/SuperAdminLogs" element={<LayoutWrapper currentPageName="SuperAdminLogs"><Suspense fallback={<PageLoader />}><SuperAdminLogs /></Suspense></LayoutWrapper>} />
      <Route path="/superadminlogs" element={<LayoutWrapper currentPageName="SuperAdminLogs"><Suspense fallback={<PageLoader />}><SuperAdminLogs /></Suspense></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <BusinessProvider>
            <Router>
              <NavigationProvider>
                <AuthenticatedApp />
              </NavigationProvider>
            </Router>
            <Toaster position="top-center" richColors expand />
          </BusinessProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
