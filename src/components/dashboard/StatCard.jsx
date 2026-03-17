import React from "react";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function StatCard({ title, value, subtitle, icon: Icon, color = "indigo", trend, href }) {
  const colors = {
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-200",
    cyan: "from-cyan-500 to-cyan-600 shadow-cyan-200",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-200",
    amber: "from-amber-500 to-amber-600 shadow-amber-200",
    rose: "from-rose-500 to-rose-600 shadow-rose-200",
  };

  const content = (
    <Card className={`relative overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-500/30 dark:hover:border-indigo-500/40 transition-all duration-300 ${href ? "cursor-pointer hover:-translate-y-0.5" : ""}`}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`font-bold text-foreground ${
              String(value).length > 14 ? "text-lg" :
              String(value).length > 10 ? "text-xl" :
              String(value).length > 7  ? "text-2xl" :
              "text-3xl"
            }`}>{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            {trend && (
              <p className={`text-xs font-medium ${trend > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs periodo anterior
              </p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${colors[color]} shadow-lg flex items-center justify-center`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </Card>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}