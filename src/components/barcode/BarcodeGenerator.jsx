import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function BarcodeGenerator({ productId, productName, businessId, onSave }) {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const barcodeRef = useRef(null);

  const generateBarcode = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("generateUniqueBarcode", {
        productId,
        businessId,
      });
      setBarcode(res.data.barcode);
    } catch (err) {
      console.error("Error generating barcode:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    if (!barcodeRef.current) return;

    const canvas = await html2canvas(barcodeRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "A6");

    const imgWidth = 100;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 5, 5, imgWidth, imgHeight);

    pdf.save(`barcode-${barcode}.pdf`);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Generar Código de Barras</CardTitle>
        {productName && <p className="text-sm text-muted-foreground mt-1">{productName}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {!barcode ? (
          <Button
            onClick={generateBarcode}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Generando..." : "Generar Código Único"}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Barcode Preview */}
            <div
              ref={barcodeRef}
              className="flex flex-col items-center justify-center bg-white p-6 rounded-lg border-2 border-slate-200"
            >
              {/* SVG Barcode via API */}
              <img
                src={`https://api.barcodeserver.com/api/barcodes?code=${barcode}&format=svg`}
                alt="barcode"
                className="h-24 mb-3"
              />
              <p className="text-sm font-mono text-slate-700">{barcode}</p>
              {productName && <p className="text-xs text-slate-500 mt-2 text-center">{productName}</p>}
            </div>

            {/* Barcode Text */}
            <div className="flex items-center gap-2">
              <Input
                value={barcode}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                title="Copiar al portapapeles"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {/* Feedback */}
            {copied && <p className="text-sm text-green-600">✅ Copiado al portapapeles</p>}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={downloadPDF}
                className="flex-1"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
              {onSave && (
                <Button onClick={() => onSave(barcode)} className="flex-1">
                  Guardar en Producto
                </Button>
              )}
            </div>

            {/* Reset */}
            <Button
              onClick={() => setBarcode("")}
              variant="ghost"
              className="w-full"
            >
              Generar Otro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}