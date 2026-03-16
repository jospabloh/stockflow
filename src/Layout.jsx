import React, { useState, useEffect } from "react";
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
  X,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Bell,
  HelpCircle
} from "lucide-react";
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
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const { businessId, isLoading: bizLoading } = useBusinessContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === "/" || location.pathname === "/Dashboard";

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

  const bottomNavItems = [
    { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    { name: "Productos", icon: Package, page: "Products" },
    { name: "Movimientos", icon: ArrowLeftRight, page: "Movements" },
    { name: "Cotizaciones", icon: FileText, page: "Quotations" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-white border-r border-slate-100 
        flex flex-col transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo area */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg tracking-tight">Inventario</h1>
              <p className="text-xs text-slate-400">Control de stock</p>
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
                    ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{user?.full_name || "Usuario"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || ""}</p>
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
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 lg:px-8 h-16 flex items-center gap-4 select-none">
          {/* Back button — mobile only, hidden on root pages */}
          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
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
          <h2 className="text-lg font-semibold text-slate-800">
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
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 page-transition pb-24 lg:pb-8" style={{ overscrollBehavior: "none" }}>
          {children}
        </main>

        {/* Footer — hidden on mobile */}
        <footer className="hidden lg:block border-t border-slate-100 bg-white/60 px-4 lg:px-8 py-3 text-center space-y-1">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} <span className="font-medium text-slate-600">ACACIA Consultoría en Informática y Cómputo</span> — Todos los derechos reservados.
          </p>
          <p className="text-xs text-slate-400">
            Licencia registrada a: <span className="font-medium text-slate-500">{user?.email || "—"}</span>
            {" · "}Soporte:{" "}
            <a href="mailto:soporte@acaciaco.com.mx" className="text-indigo-500 hover:underline">soporte@acaciaco.com.mx</a>
            {" · "}WhatsApp:{" "}
            <a href="https://wa.me/524498958291" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">+52 449 895 8291</a>
          </p>
        </footer>
      </div>
    </div>
  );
}