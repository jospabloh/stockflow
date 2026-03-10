import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Home, Package } from "lucide-react";

export default function PageNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center mb-6">
        <Package className="h-10 w-10 text-indigo-400" />
      </div>
      <h1 className="text-4xl font-bold text-slate-800 mb-2">404</h1>
      <p className="text-lg text-slate-500 mb-8">Página no encontrada</p>
      <Link to={createPageUrl("Dashboard")}>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Home className="h-4 w-4 mr-2" /> Ir al inicio
        </Button>
      </Link>
    </div>
  );
}