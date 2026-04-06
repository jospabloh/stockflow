import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useNavigation } from "@/lib/NavigationContext";

// Detect if running as installed PWA / native app (not regular browser tab)
const IS_NATIVE_APP = typeof window !== "undefined" && (
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true
);
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { useSessionManager } from "@/hooks/useSessionManager";
import SessionBanner from "@/components/SessionBanner";
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
  Monitor
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Productos", icon: Package, page: "Products" },
  { name: "Movimientos", icon: ArrowLeftRight, page: "Movements" },
  { name: "Cotizaciones", icon: FileText, page: "Quotations" },
  { name: "Caja Chica", icon: PiggyBank, page: "PettyCash" },
  { name: "Reportes", icon: BarChart3, page: "Reports" },
  { name: "Configuración", icon: Settings, page: "Settings" },
  { name: "Centro de Ayuda", icon: HelpCircle, page: "HelpCenter" },
  { name: "Acerca de", icon: HelpCircle, page: "About" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
  const mainRef = useRef(null);
  const { businessId, businessName, businessNameLocked, isLoading: bizLoading, user } = useBusinessContext();
  const { sessionStatus, reactivate } = useSessionManager(!!businessId);
  const { goBack, direction } = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === "/" || location.pathname === "/Dashboard";
  const isChildRoute = /\/(Products|Movements|Quotations)\/(new|edit)/.test(location.pathname);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!businessId) return;
    base44.entities.Product.filter({ status: "active", business_id: businessId }).then(products => {
      const low = products.filter(p => p.stock <= p.min_stock).length;
      setLowStockCount(low);
    }).catch(() => {});
  }, [businessId]);

  useEffect(() => {
    if (!bizLoading && !businessId) {
      navigate("/BusinessSetup");
    }
  }, [businessId, bizLoading, navigate]);

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
      window.location.reload();
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
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-lg tracking-tight">StockFlow</h1>
              <p className="text-xs text-muted-foreground">{businessName || "Control de stock"}</p>
            </div>
          </div>

        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
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
          {(!isRoot || isChildRoute) && (
            <Button
              variant="ghost"
              size="icon"
              className={isRoot && !isChildRoute ? "hidden" : ""}
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
            {navItems.find(n => n.page === currentPageName)?.name || currentPageName}
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

        {/* Session passive banner */}
        {sessionStatus === 'passive' && (
          <SessionBanner onReactivate={reactivate} />
        )}

        {/* Page content with framer-motion animations */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            ref={mainRef}
            className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 overflow-y-auto"
            initial={{ opacity: 0, x: direction === 'back' ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 'back' ? 30 : -30 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
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

      {/* Bottom Tab Bar — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-border flex lg:hidden select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
        role="tablist"
      >
        {bottomNavItems.map((item) => {
          const isActive = currentPageName === item.page;
          const targetUrl = createPageUrl(item.page);
          return (
            <button
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