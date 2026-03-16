import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Heart, Code, Users } from "lucide-react";

export default function About() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6">
      <div className="text-center space-y-2 mb-8">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg mx-auto">
          <Code className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Inventario StockFlow</h1>
        <p className="text-slate-500">Sistema integral de control de inventario</p>
      </div>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Acerca de</h2>
        <p className="text-slate-600 leading-relaxed">
          StockFlow es una solución moderna y completa para la gestión de inventario, diseñada para pequeñas y medianas empresas. 
          Proporciona herramientas intuitivas para controlar productos, movimientos de stock, cotizaciones y reportes en tiempo real.
        </p>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-500" />
          Equipo Desarrollador
        </h2>
        <p className="text-slate-600">
          Desarrollado por <span className="font-semibold text-foreground">ACACIA Consultoría en Informática y Cómputo</span>
        </p>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Derechos Reservados</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            © {new Date().getFullYear()} <span className="font-medium text-foreground">ACACIA Consultoría en Informática y Cómputo</span>
          </p>
          <p>Todos los derechos reservados.</p>
          <p className="text-xs text-slate-500">
            Licencia registrada a: <span className="font-medium text-foreground">{user?.email || "—"}</span>
          </p>
        </div>
      </Card>

      <Card className="border-0 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Contacto y Soporte</h2>
        <div className="space-y-3">
          <p className="text-slate-600">
            Para consultas o soporte técnico:
          </p>
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

      <Card className="border-0 shadow-sm p-6 space-y-4 bg-indigo-50/50 border border-indigo-100/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Hecho con cuidado
        </h2>
        <p className="text-slate-600">
          Desarrollado con dedicación para ofrecerte la mejor experiencia en la gestión de tu inventario.
        </p>
      </Card>
    </div>
  );
}