import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import BarcodeGenerator from "@/components/barcode/BarcodeGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check } from "lucide-react";

export default function BarcodeGeneratorPage() {
  const [searchParams] = useSearchParams();
  const { businessId } = useBusinessContext();
  const [product, setProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const productId = searchParams.get("productId");

  useEffect(() => {
    if (productId) {
      base44.entities.Product.filter({ id: productId }).then(([prod]) => {
        setProduct(prod);
      });
    }
  }, [productId]);

  const handleSave = async (barcode) => {
    if (!product) return;

    setSaving(true);
    try {
      await base44.entities.Product.update(product.id, {
        barcode,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving barcode:", err);
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

          {/* Generator */}
          <BarcodeGenerator
            productId={product.id}
            productName={product.name}
            businessId={businessId}
            onSave={handleSave}
          />

          {/* Feedback */}
          {saved && (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <Check className="h-5 w-5" />
              <p className="font-medium">Código de barras guardado exitosamente</p>
            </div>
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