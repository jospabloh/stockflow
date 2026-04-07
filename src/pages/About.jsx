import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Package, Users, Tag, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { APP_VERSION, RELEASE_DATE, CHANGELOG } from "@/lib/appConfig";

export default function About() {
  const [user, setUser] = useState(null);
  const [historialOpen, setHistorialOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const latestRelease = CHANGELOG[0];

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6">
      <div className="text-center space-y-2 mb-8">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg mx-auto">
          <Package className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">StockFlow</h1>
        <p className="text-muted-foreground">Sistema integral de control de inventario</p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <Badge className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-sm px-3 py-1">
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Versión {APP_VERSION}
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {RELEASE_DATE}
          </Badge>
        </div>
      </div>

      {/* Versión actual y últimos cambios */}
      <Card className="border-0 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Versión actual</h2>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{APP_VERSION}</span>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Últimos cambios</p>
          <ul className="space-y-2">
            {latestRelease.changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{change}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Acerca de</h2>
        <p className="text-muted-foreground leading-relaxed">
          StockFlow es una solución moderna y completa para la gestión de inventario, diseñada para pequeñas y medianas empresas.
          Proporciona herramientas intuitivas para controlar productos, movimientos de stock, cotizaciones y reportes en tiempo real.
        </p>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-500" />
          Equipo Desarrollador
        </h2>
        <p className="text-muted-foreground">
          Desarrollado por <span className="font-semibold text-foreground">ACACIA Consultoría en Informática y Cómputo</span>
        </p>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Derechos Reservados</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} <span className="font-medium text-foreground">ACACIA Consultoría en Informática y Cómputo</span>
          </p>
          <p>Todos los derechos reservados.</p>
          <p className="text-xs text-muted-foreground">
            Licencia registrada a: <span className="font-medium text-foreground">{user?.email || "—"}</span>
          </p>
        </div>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Contacto y Soporte</h2>
        <div className="space-y-3">
          <p className="text-muted-foreground">Para consultas o soporte técnico:</p>
          <div className="space-y-2 text-sm">
            <p>
              📧 Email:{" "}
              <a href="mailto:soporte@acaciaco.com.mx" className="text-indigo-500 hover:underline font-medium">
                soporte@acaciaco.com.mx
              </a>
            </p>
            <p>
              💬 WhatsApp:{" "}
              <a href="https://wa.me/524498958291" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline font-medium">
                +52 449 895 8291
              </a>
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Hecho con cuidado
        </h2>
        <p className="text-muted-foreground">
          Desarrollado con dedicación para ofrecerte la mejor experiencia en la gestión de tu inventario.
        </p>
      </Card>

      {/* Historial de versiones — colapsable al final */}
      {CHANGELOG.length > 1 && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <button
            onClick={() => setHistorialOpen(!historialOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-muted-foreground">Historial de versiones anteriores</span>
            {historialOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {historialOpen && (
            <div className="px-6 pb-5 space-y-4 border-t border-border pt-4">
              {CHANGELOG.slice(1).map((release) => (
                <div key={release.version} className="border-l-2 border-border pl-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">v{release.version}</span>
                    <span className="text-xs text-muted-foreground">{release.date}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {release.changes.map((change, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-0.5">•</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}