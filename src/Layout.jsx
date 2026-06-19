import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useNavigation } from "@/lib/NavigationContext";
import { useLicense } from "@/lib/LicenseContext";
import { usePermissions } from "@/lib/PermissionContext";
import TrialBanner from "@/components/license/TrialBanner";
import FloatingHelpChat from "@/components/chat/FloatingHelpChat";

// Detect if running as installed PWA / native app (not regular browser tab)
const IS_NATIVE_APP = typeof globalThis !== "undefined" && (
  globalThis.matchMedia("(display-mode: standalone)").matches ||
  globalThis.navigator.standalone === true
);
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useRegionalConfig } from "@/hooks/useRegionalConfig";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import SessionBanner from "@/components/SessionBanner";
import SessionExpiredDialog from "@/components/SessionExpiredDialog";
import IdleWarningDialog from "@/components/IdleWarningDialog";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  PiggyBank,
  FileText,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Bell,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Briefcase,
  DollarSign,
  Palette,
  Users,
  Shield,
  HandCoins,
  Wallet,
  Tag,
  CreditCard
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  {
    name: "Catálogos",
    icon: Briefcase,
    submenu: [
      { name: "Productos", icon: Package, page: "Products" },
      { name: "Categorías", icon: Palette, page: "Categories" },
      { name: "Proveedores", icon: Users, page: "Suppliers" },
      { name: "Clientes", icon: Users, page: "Clients" },
      { name: "Tipo de pago", icon: DollarSign, page: "PaymentMethods" },
      { name: "Rubros", icon: Tag, page: "Rubros" },
      { name: "Cuentas", icon: CreditCard, page: "FundAccounts" },
    ]
  },
  { name: "Movimientos", icon: ArrowLeftRight, page: "Movements" },
  { name: "Cotizaciones", icon: FileText, page: "Quotations" },
  { name: "Caja Chica", icon: PiggyBank, page: "PettyCash" },
  { name: "Utilidad", icon: Wallet, page: "Utility" },
  { name: "Pagos a Proveedores", icon: HandCoins, page: "SupplierPayments" },
  { name: "Reportes", icon: BarChart3, page: "Reports" },
  { name: "Configuración", icon: Settings, page: "Settings" },
  { name: "Permisos", icon: Shield, page: "PermissionAdmin", adminOrPlatformAdmin: true },
  {
    name: "Sistema",
    icon: Shield,
    platformAdminOnly: true,
    submenu: [
      { name: "Licencias", icon: Shield, page: "LicenseAdmin" },
      { name: "Reglas por Tenant", icon: Shield, page: "TenantRulesAdmin" },
      { name: "Logs de Correos", icon: Shield, page: "SuperAdminLogs" },
    ]
  },
  { name: "Centro de Ayuda", icon: HelpCircle, page: "HelpCenter" },
  { name: "Acerca de", icon: HelpCircle, page: "About" },
];

// Flat map para encontrar páginas y detectar si están en submenu
const getPageFromNavItems = (pageName) => {
  for (const item of navItems) {
    if (item.page === pageName) return item;
    if (item.submenu) {
      const subItem = item.submenu.find(s => s.page === pageName);
      if (subItem) return { ...subItem, parent: item };
    }
  }
  return null;
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSubmenu, setExpandedSubmenu] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
  const mainRef = useRef(null);
  const { businessId, businessName, isLoading: bizLoading, user } = useBusinessContext();
  const { isPlatformAdmin } = useLicense();
  const { canSee } = usePermissions();
  const { sessionStatus, reactivate, sessionExpired, idleState, continueSession } = useSessionManager(!!businessId);
  useRegionalConfig();
  useActivityTracker(!!businessId);
  const { goBack, direction, navigationStack } = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const isGlobalAdminRoute =
    currentPageName === "SuperAdminLogs" ||
    currentPageName === "LicenseAdmin" ||
    currentPageName === "TenantRulesAdmin" ||
    location.pathname === "/SuperAdminLogs" ||
    location.pathname === "/superadminlogs" ||
    location.pathname === "/LicenseAdmin" ||
    location.pathname === "/TenantRulesAdmin";
  const isRoot = location.pathname === "/" || location.pathname === "/Dashboard";
  const isChildRoute = /\/(Products|Movements|Quotations)\/(new|edit)/.test(location.pathname);
  const { theme, setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  // Auto-expand "Catálogos"/"Sistema" si estamos en una página hijo
  useEffect(() => {
    const current = getPageFromNavItems(currentPageName);
    const parentName = current?.parent?.name;
    if (parentName === "Catálogos" || parentName === "Sistema") {
      setExpandedSubmenu(parentName);
    }
  }, [currentPageName]);

  useEffect(() => {
    if (!businessId) return;

    const isLowStockProduct = (product) => {
      if (!product || product.status !== "active") return false;

      const stock = Number(product.stock ?? 0);
      const minStock = Number(product.min_stock);

      if (!Number.isFinite(minStock)) return false;

      return stock <= minStock;
    };

    base44.entities.Product
      .filter({ business_id: businessId }, "-created_date", 500)
      .then((products) => {
        const low = products.filter(isLowStockProduct).length;
        setLowStockCount(low);
      })
      .catch(() => {});
  }, [businessId, location.pathname]);

  useEffect(() => {
    if (!bizLoading && !businessId && !isGlobalAdminRoute) {
      navigate("/BusinessSetup");
    }
  }, [businessId, bizLoading, isGlobalAdminRoute, navigate]);

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Pull-to-refresh — only active when running as installed app (standalone/native mode)
  const handleTouchStart = useCallback((e) => {
    if (!IS_NATIVE_APP) return;
    if (mainRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!IS_NATIVE_APP || touchStartY.current === 0) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy, 90));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!IS_NATIVE_APP) return;
    if (pullY > 70) {
      setRefreshing(true);
      globalThis.location.reload();
    }
    setPullY(0);
    touchStartY.current = 0;
    setTimeout(() => setRefreshing(false), 1500);
  }, [pullY]);

  // Preserve scroll position per page across tab switches
  useEffect(() => {
    const saved = parseInt(sessionStorage.getItem(`scroll_${currentPageName}`) || "0", 10);
    requestAnimationFrame(() => {
      if (mainRef.current && saved) mainRef.current.scrollTop = saved;
    });
    return () => {
      if (mainRef.current) {
        sessionStorage.setItem(`scroll_${currentPageName}`, String(mainRef.current.scrollTop));
      }
    };
  }, [currentPageName]);

  const bottomNavItems = [
    { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    { name: "Productos", icon: Package, page: "Products" },
    { name: "Movimientos", icon: ArrowLeftRight, page: "Movements" },
    { name: "Cotizaciones", icon: FileText, page: "Quotations" },
  ];

  return (
    <div className="min-h-screen bg-background flex" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        aria-label="Menú lateral"
        className={`fixed lg:sticky top-0 left-0 z-50 h-svh w-72 bg-card border-r border-border 
        flex flex-col transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo area */}
        <div className="p-6 border-b border-border space-y-3">
          <div className="flex items-center gap-3">
            <img src="https://media.base44.com/images/public/69af971d0fdb362c9ae52ed3/5032b5555_StockFlow_logo.png" alt="StockFlow" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="font-bold text-foreground text-lg tracking-tight">StockFlow</h1>
              <p className="text-xs text-muted-foreground">{businessName || "Control de stock"}</p>
            </div>
          </div>

        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {navItems
            .filter(item => !item.platformAdminOnly || isPlatformAdmin)
            .filter(item => !item.adminOrPlatformAdmin || isPlatformAdmin || user?.role === 'admin')
            .filter(item => {
              if (item.page) return canSee(item.page);
              if (item.submenu) return item.submenu.some(s => canSee(s.page));
              return true;
            })
            .map((item) => {
            const isActive = currentPageName === item.page;
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isSubmenuOpen = expandedSubmenu === item.name;
            const currentInSubmenu = item.submenu?.some(s => s.page === currentPageName);
            const visibleSubitems = item.submenu?.filter(s => canSee(s.page) && (!s.ownerEmailOnly || user?.email === s.ownerEmailOnly)) || [];

            if (hasSubmenu) {
              return (
                <div key={item.name}>
                  <button type="button"
                    onClick={() => setExpandedSubmenu(isSubmenuOpen ? null : item.name)}
                    aria-expanded={isSubmenuOpen}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                      ${currentInSubmenu || isSubmenuOpen
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                  >
                    <item.icon className={`h-5 w-5 ${currentInSubmenu || isSubmenuOpen ? "text-indigo-600" : ""}`} aria-hidden="true" />
                    <span>{item.name}</span>
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${isSubmenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isSubmenuOpen && (
                    <div className="mt-1 ml-2 border-l border-indigo-200 dark:border-indigo-800 pl-2 space-y-0.5">
                      {visibleSubitems.map((subitem) => {
                        const subIsActive = currentPageName === subitem.page;
                        return (
                          <Link
                            key={subitem.page}
                            to={createPageUrl(subitem.page)}
                            onClick={() => setSidebarOpen(false)}
                            aria-label={subitem.name}
                            aria-current={subIsActive ? "page" : undefined}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200
                              ${subIsActive 
                                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              }`}
                          >
                            <subitem.icon className={`h-4 w-4 ${subIsActive ? "text-indigo-600" : ""}`} aria-hidden="true" />
                            <span>{subitem.name}</span>
                            {subIsActive && <ChevronRight className="h-3 w-3 ml-auto text-indigo-400" aria-hidden="true" />}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                aria-label={item.name}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-indigo-600" : ""}`} aria-hidden="true" />
                <span>{item.name}</span>
                {item.page === "Dashboard" && lowStockCount > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs h-5 px-1.5" aria-label={`${lowStockCount} productos con stock bajo`}>
                    {lowStockCount}
                  </Badge>
                )}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto text-indigo-400" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={handleLogout} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-svh">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 lg:px-8 h-16 flex items-center gap-4 select-none">
          {/* Back button — mobile only, visible on child routes and non-root pages */}
          {(!isRoot || isChildRoute) && navigationStack.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              aria-label="Regresar"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`lg:hidden ${!isRoot ? "hidden" : ""}`}
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar-nav"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          {/* Always show hamburger on desktop; on mobile only on root */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setSidebarOpen(true)}
            style={{ display: "none" }}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {(() => {
              const current = getPageFromNavItems(currentPageName);
              return current?.name || currentPageName;
            })()}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {lowStockCount > 0 && (
              <Link to={createPageUrl("Products") + "?filter=low_stock"}>
                <Button variant="ghost" size="icon" className="relative" aria-label={`${lowStockCount} productos con stock bajo`}>
                  <Bell className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" aria-hidden="true">
                    {lowStockCount}
                  </span>
                </Button>
              </Link>
            )}
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
              aria-label={`Tema: ${theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema"}`}
              title={theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema"}
            >
              {theme === "dark" ? <Moon className="h-5 w-5 text-slate-500" aria-hidden="true" /> : theme === "light" ? <Sun className="h-5 w-5 text-slate-500" aria-hidden="true" /> : <Monitor className="h-5 w-5 text-slate-500" aria-hidden="true" />}
            </Button>
          </div>
        </header>

        {/* Trial / license banner */}
        <div className="flex-shrink-0">
          <TrialBanner />
        </div>

        {/* Session passive banner */}
        {sessionStatus === 'passive' && (
          <SessionBanner onReactivate={reactivate} />
        )}

        {/* Idle warning dialog */}
        <IdleWarningDialog open={idleState === 'idle_warning'} onContinue={continueSession} />

        {/* Session expired dialog */}
        <SessionExpiredDialog open={sessionExpired} />

        {/* Page content with framer-motion animations */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            ref={mainRef}
            className="flex-1 p-4 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 overflow-y-auto"
            initial={prefersReducedMotion ? false : { opacity: 0, x: direction === 'back' ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction === 'back' ? 30 : -30 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Pull-to-refresh indicator — only shown in native/standalone mode */}
            {IS_NATIVE_APP && (pullY > 10 || refreshing) && (
              <div
                className="flex items-center justify-center transition-all duration-150"
                style={{ height: refreshing ? 44 : pullY * 0.5 }}
              >
                <div
                  className={`h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full ${refreshing ? "animate-spin" : ""}`}
                  style={{ transform: refreshing ? undefined : `rotate(${pullY * 4}deg)` }}
                />
              </div>
            )}
            {children}
          </motion.main>
        </AnimatePresence>


      </div>

      {/* Floating Help Chat */}
      <FloatingHelpChat />

      {/* Bottom Tab Bar — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[70] bg-card border-t border-border flex lg:hidden select-none pointer-events-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
        role="tablist"
      >
        {bottomNavItems.map((item) => {
          const isActive = currentPageName === item.page;
          const targetUrl = createPageUrl(item.page);
          return (
            <button type="button"
              key={item.page}
              role="tab"
              aria-selected={isActive}
              aria-label={item.name}
              onClick={() => {
                // Save current scroll before leaving
                if (mainRef.current) {
                  sessionStorage.setItem(`scroll_${currentPageName}`, String(mainRef.current.scrollTop));
                }
                if (isActive) {
                  // Re-tap active tab: scroll to top
                  if (mainRef.current) mainRef.current.scrollTop = 0;
                } else {
                  navigate(targetUrl, { replace: false });
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[12px] font-medium transition-colors min-h-[44px] relative
                ${isActive ? "text-indigo-500" : "text-muted-foreground"}`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-indigo-500" : "text-muted-foreground"}`} aria-hidden="true" />
              <span>{item.name}</span>
              {item.page === "Dashboard" && lowStockCount > 0 && (
                <span className="absolute top-1 right-[calc(50%-18px)] h-4 w-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center" aria-hidden="true">
                  {lowStockCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
