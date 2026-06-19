import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBusinessContext } from "@/components/BusinessContext";
import { ShoppingCart, ArrowRight, Package } from "lucide-react";

export default function OnDemandPendingPanel() {
  const { businessId } = useBusinessContext();
  const navigate = useNavigate();
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);

    base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 200)
      .then(quotations => {
        const converted = quotations.filter(q => q.status === "converted" || q.status === "accepted");
        const pending = [];
        for (const q of converted) {
          for (let i = 0; i < (q.items || []).length; i++) {
            const item = q.items[i];
            if (item.is_on_demand && item.on_demand_status === "pending") {
              pending.push({ ...item, _quotation: q, _itemIndex: i });
            }
          }
        }
        setPendingItems(pending);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-orange-50 dark:bg-orange-950/20">
        <ShoppingCart className="h-4 w-4 text-orange-500" />
        <h3 className="font-semibold text-sm text-orange-700 dark:text-orange-400">
          Productos bajo pedido pendientes
        </h3>
        {pendingItems.length > 0 && (
          <Badge className="ml-auto bg-orange-500 text-white text-xs">{pendingItems.length}</Badge>
        )}
      </div>

      {pendingItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">Sin ítems bajo pedido pendientes</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {pendingItems.map((item, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="tabular">{item.quantity} {item.unit || "uds"}</span>
                  {item.supplier_name && <span>· {item.supplier_name}</span>}
                  <span>· Cot. <strong>{item._quotation.folio}</strong></span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={() => navigate(`/Quotations/edit/${item._quotation.id}`)}
              >
                Ir <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}