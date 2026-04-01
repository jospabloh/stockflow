import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import BarcodeGenerator from "@/components/barcode/BarcodeGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

export default function BarcodeGeneratorPage() {
  const [searchParams] = useSearchParams();
  const { businessId } = useBusinessContext();
  const [product, setProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  const productId = searchParams.get("productId");

  useEffect(() => {
    if (productId && businessId) {
      base44.entities.Product.filter({ id: productId, business_id: businessId })
        .then((products) => {
          if (products.length > 0) {
            setProduct(products[0]);
          }
        })
        .catch(err => {
          console.error("Error loading product:", err);
          toast.error("Error al cargar el producto");
        });
    }
  }, [productId, businessId]);

  const handleSave = async (barcode) => {
    if (!product || !product.id) {
      toast.error("Producto no identificado");
      return;
    }

    setSaving(true);
    try {
      await base44.entities.Product.update(product.id, {
        barcode,
      });
      setProduct({ ...product, barcode });
      toast.success("Código de barras guardado exitosamente");
    } catch (err) {
      console.error("Error saving barcode:", err);
      toast.error("Error al guardar: " + (err.message || "intenta nuevamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Generador de Códigos de Barras</h1>
        <p className="text-muted-foreground">Crea códigos de barras únicos y descárgalos como PDF</p>
      </div>

      {product ? (
        <div className="space-y-6">
          {/* Product Info */}
          <Card className="border-0 shadow-sm bg-slate-50">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-600">Producto</p>
              <p className="text-lg font-bold">{product.name}</p>
              {product.barcode && (
                <div className="mt-3 flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <p className="text-sm">Código actual: <span className="font-mono">{product.barcode}</span></p>
                </div>
              )}
              {!product.barcode && (
                <div className="mt-3 flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">Sin código de barras asignado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generator - only show if no barcode */}
          {!product.barcode && (
            <BarcodeGenerator
              productId={product.id}
              productName={product.name}
              businessId={businessId}
              onSave={handleSave}
              isSaving={saving}
            />
          )}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {productId ? "Cargando producto..." : "Selecciona un producto para generar su código de barras"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}