import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
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
  { name: "Reportes", icon: BarChart3, page: "Reports" },
  { name: "Configuración", icon: Settings, page: "Settings" },
  { name: "Centro de Ayuda", icon: HelpCircle, page: "HelpCenter" },
  { name: "Acerca de", icon: HelpCircle, page: "About" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
  const mainRef = useRef(null);
  const { businessId, isLoading: bizLoading } = useBusinessContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === "/" || location.pathname === "/Dashboard";
  const isChildRoute = /\/(Products|Movements|Quotations)\/(new|edit)/.test(location.pathname);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Product.filter({ status: "active" }).then(products => {
      const low = products.filter(p => p.stock <= p.min_stock).length;
      setLowStockCount(low);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bizLoading && !businessId) {
      navigate("/BusinessSetup");
    }
  }, [businessId, bizLoading, navigate]);

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e) => {
    if (mainRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === 0) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && mainRef.current?.scrollTop === 0) {
      setPullY(Math.min(dy, 80));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullY > 60) {
      setPulling(true);
      window.location.reload();
    }
    setPullY(0);
    touchStartY.current = 0;
    setTimeout(() => setPulling(false), 1000);
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
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-card border-r border-border 
        flex flex-col transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo area */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-lg tracking-tight">Inventario</h1>
              <p className="text-xs text-muted-foreground">Control de stock</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-indigo-600" : ""}`} />
                <span>{item.name}</span>
                {item.page === "Dashboard" && lowStockCount > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs h-5 px-1.5">
                    {lowStockCount}
                  </Badge>
                )}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto text-indigo-400" />}
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 lg:px-8 h-16 flex items-center gap-4 select-none">
          {/* Back button — mobile only, visible on child routes and non-root pages */}
          {(!isRoot || isChildRoute) && (
            <Button
              variant="ghost"
              size="icon"
              className={isRoot && !isChildRoute ? "hidden" : ""}
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`lg:hidden ${!isRoot ? "hidden" : ""}`}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {/* Always show hamburger on desktop; on mobile only on root */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setSidebarOpen(true)}
            style={{ display: "none" }}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {navItems.find(n => n.page === currentPageName)?.name || currentPageName}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {lowStockCount > 0 && (
              <Link to={createPageUrl("Products") + "?filter=low_stock"}>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-slate-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
              title={theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema"}
            >
              {theme === "dark" ? <Moon className="h-5 w-5 text-slate-500" /> : theme === "light" ? <Sun className="h-5 w-5 text-slate-500" /> : <Monitor className="h-5 w-5 text-slate-500" />}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main
          ref={mainRef}
          className="flex-1 p-4 lg:p-8 page-transition pb-24 lg:pb-8 overflow-y-auto"
          style={{ overscrollBehavior: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pull-to-refresh indicator */}
          {(pullY > 0 || pulling) && (
            <div
              className="flex items-center justify-center transition-all duration-200"
              style={{ height: pulling ? 48 : pullY * 0.6, marginTop: pulling ? 0 : -8 }}
            >
              <div className={`h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full ${pulling ? "animate-spin" : ""}`}
                style={{ transform: `rotate(${pullY * 3}deg)` }}
              />
            </div>
          )}
          {children}
        </main>


      </div>

      {/* Bottom Tab Bar — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex lg:hidden select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {bottomNavItems.map((item) => {
          const isActive = currentPageName === item.page;
          const targetUrl = createPageUrl(item.page);
          return (
            <button
              key={item.page}
              onClick={() => navigate(targetUrl, { replace: isActive })}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[12px] font-medium transition-colors min-h-[44px] relative
                ${isActive ? "text-indigo-500" : "text-muted-foreground"}`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-indigo-500" : "text-muted-foreground"}`} />
              <span>{item.name}</span>
              {item.page === "Dashboard" && lowStockCount > 0 && (
                <span className="absolute top-1 right-[calc(50%-18px)] h-4 w-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">
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