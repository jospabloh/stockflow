import React, { useState, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

// CODE128 Barcode Generator - Standard Implementation
class Code128Encoder {
  constructor() {
    this.CODE128_PATTERNS = [
      "11011001100", "11001101100", "11001100110", "10010011000", "10010001100", "10001001100",
      "10011001000", "10011000100", "10001100100", "11001010000", "11001000100", "11000100100",
      "10110011100", "10011011100", "10011001110", "10111001100", "10100011100", "10001011100",
      "10111000100", "10001110100", "11101101110", "11101001100", "11100100110", "11100010110",
      "11011100100", "11001110100", "11101100100", "11100110100", "11101011000", "11101001000",
      "11100101000", "11010100100", "11010001000", "11000101000", "11011010000", "11011000100",
      "11000110100", "10101111000", "10100011110", "10001011110", "10111010100", "10111000110",
      "10001110110", "10100111010", "10010111010", "10010001110", "10000101110", "10000100110",
      "10110010100", "10110001000", "10110000100", "10011010100", "10011001000", "10011000010",
      "10101101000", "10101100010", "10100110010", "10010110100", "10010110010", "10010101000",
      "11000101010", "11000100110", "11000010110", "10110101000", "10110100010", "10110010010",
      "10101011000", "10101001100", "10100101100", "10010110010", "10010100110", "10010010110",
      "10000110110", "10000101100", "10000100010", "11000010010", "11001010010", "11010010010",
      "11010001010", "11010010100", "11000101100", "11001010100", "11001001010", "11010101000",
      "11010100100", "11010010010", "11000110010", "11101011010", "11101001110", "11100101110",
      "11100010110", "11101101100", "11101100110", "11100110110", "11101010110", "11100101100",
      "11100100110", "11101100100", "11101010100", "11101001010", "11100101010", "11010111000",
      "11010110100", "11010101110", "11010100110", "11010010110", "11011101000", "11011100100",
      "11011101110", "11011100110", "11011010110", "11011001110", "11011010100", "11011001100",
      "11011000110", "11101110110", "11101001110", "11100110110", "10011110110"
    ];
  }

  encode(text) {
    const codes = [];
    codes.push(104); // START CODE B
    let sum = 104;
    
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      codes.push(code);
      sum += code * (i + 1);
    }
    
    codes.push(sum % 103); // CHECKSUM
    codes.push(106); // STOP
    
    return codes;
  }

  getBarcode(text) {
    const codes = this.encode(text);
    let barcode = "";
    for (let code of codes) {
      barcode += this.CODE128_PATTERNS[code];
    }
    return barcode;
  }

  toSVG(text, barHeight = 80) {
    const barcode = this.getBarcode(text);
    const moduleWidth = 2;
    const width = barcode.length * moduleWidth;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}" viewBox="0 0 ${width} ${barHeight}">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;
    
    let x = 0;
    for (let bit of barcode) {
      if (bit === "1") {
        svg += `<rect x="${x}" y="0" width="${moduleWidth}" height="${barHeight}" fill="black"/>`;
      }
      x += moduleWidth;
    }
    svg += `</svg>`;
    return svg;
  }
}

// Componente para renderizar el barcode
function BarcodeDisplay({ barcode }) {
  const svgContent = useMemo(() => {
    const encoder = new Code128Encoder();
    return encoder.toSVG(barcode, 80);
  }, [barcode]);
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: svgContent }} 
      className="flex justify-center"
    />
  );
}

export default function BarcodeGenerator({ productId, productName, businessId, onSave, isSaving = false }) {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const barcodeRef = useRef(null);

  const generateBarcode = async () => {
    setLoading(true);
    try {
      // Generate barcode locally without consuming API credits
      function calculateEAN13Checksum(code) {
        let sum = 0;
        for (let i = 0; i < code.length; i++) {
          const digit = parseInt(code[i]);
          sum += (i % 2 === 0 ? digit : digit * 3);
        }
        return ((10 - (sum % 10)) % 10).toString();
      }

      const randomPart = Math.floor(Math.random() * 9999999999).toString().padStart(9, "0");
      const baseCode = "750" + randomPart;
      const checksum = calculateEAN13Checksum(baseCode);
      const newBarcode = baseCode + checksum;
      
      setBarcode(newBarcode);
      toast.success("Código de barras generado exitosamente");
    } catch (err) {
      console.error("Error generating barcode:", err);
      toast.error("Error al generar código: " + (err.message || "intenta nuevamente"));
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

   const canvas = await html2canvas(barcodeRef.current, { scale: 3, backgroundColor: "#ffffff" });
   const imgData = canvas.toDataURL("image/png");
   const pdf = new jsPDF("p", "mm", "A6");

   const imgWidth = 85;
   const imgHeight = (canvas.height * imgWidth) / canvas.width;
   const yOffset = (148 - imgHeight) / 2;
   pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, imgHeight);

   pdf.save(`barcode-${barcode}.pdf`);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Código de Barras</CardTitle>
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
              className="flex flex-col items-center justify-center bg-white p-8 rounded-lg border-2 border-slate-200"
              style={{ minHeight: '200px' }}
            >
              {/* Generated SVG Barcode */}
              <div className="w-full flex justify-center mb-4">
                <BarcodeDisplay barcode={barcode} />
              </div>
              <p className="text-base font-mono font-bold text-slate-900">{barcode}</p>
              {productName && <p className="text-xs text-slate-600 mt-3 text-center max-w-xs">{productName}</p>}
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
                <Button 
                  onClick={() => onSave(barcode)} 
                  className="flex-1"
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isSaving ? "Guardando..." : "Guardar en Producto"}
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