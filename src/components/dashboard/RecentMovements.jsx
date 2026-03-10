import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import moment from "moment";

const typeConfig = {
  entry: { label: "Entrada", icon: ArrowDownLeft, color: "bg-emerald-100 text-emerald-700" },
  exit: { label: "Salida", icon: ArrowUpRight, color: "bg-rose-100 text-rose-700" },
  return: { label: "Devolución", icon: RotateCcw, color: "bg-amber-100 text-amber-700" },
  adjustment: { label: "Ajuste", icon: SlidersHorizontal, color: "bg-blue-100 text-blue-700" },
};

export default function RecentMovements({ movements }) {
  return (
    <Card className="border-0 shadow-sm">
      <div className="p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Movimientos Recientes</h3>
        {movements.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Sin movimientos recientes</p>
        ) : (
          <div className="space-y-3">
            {movements.slice(0, 8).map((mov) => {
              const config = typeConfig[mov.type] || typeConfig.adjustment;
              const IconComp = config.icon;
              return (
                <div key={mov.id} className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${config.color}`}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{mov.product_name}</p>
                    <p className="text-xs text-slate-400">{moment(mov.created_date).fromNow()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${mov.type === "exit" ? "text-rose-600" : "text-emerald-600"}`}>
                      {mov.type === "exit" ? "-" : "+"}{mov.quantity}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}