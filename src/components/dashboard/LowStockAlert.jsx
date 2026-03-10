import React from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function LowStockAlert({ products }) {
  if (!products || products.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-slate-700">Stock Bajo</h3>
          <span className="ml-auto text-xs text-slate-400 bg-amber-50 px-2 py-1 rounded-full">
            {products.length} producto{products.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-3">
          {products.slice(0, 5).map((product) => (
            <div key={product.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{product.name}</p>
                <p className="text-xs text-slate-400">Mín: {product.min_stock} {product.unit}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${product.stock <= 0 ? "text-red-600" : "text-amber-600"}`}>
                  {product.stock} {product.unit}
                </p>
              </div>
            </div>
          ))}
          {products.length > 5 && (
            <Link
              to={createPageUrl("Products") + "?filter=low_stock"}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Ver todos →
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}