import React, { useState, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Componente para renderizar el barcode
function BarcodeDisplay({ barcode }) {
  const svgContent = useMemo(() => {
    // Generar SVG CODE128 simple
    const bars = [];
    let x = 0;
    const barHeight = 80;
    
    // Patrón simplificado: cada carácter = grupo de barras blancas/negras
    for (let i = 0; i < barcode.length; i++) {
      const char = barcode.charCodeAt(i);
      const pattern = (char % 16).toString(2).padStart(4, "0");
      
      for (let j = 0; j < pattern.length; j++) {
        const barWidth = 2 + Math.floor(char % 3);
        if (pattern[j] === "1") {
          bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${barHeight}" fill="black"/>`);
        }
        x += barWidth;
      }
    }
    
    return `<svg width="${x + 20}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${bars.join("")}</svg>`;
  }, [barcode]);
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: svgContent }} 
      className="flex justify-center"
    />
  );
}

// Función para generar barcode CODE128 como SVG
const generateCode128SVG = (text) => {
  const CODE128_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  const CODE128_PATTERNS = [
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
  
  const START_C = 105;
  const STOP = 106;
  
  // Encode to CODE128-B (alphanumeric + ASCII)
  let encoded = [START_C];
  let sum = START_C;
  
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    encoded.push(code);
    sum += code * (i + 1);
  }
  
  const checksum = sum % 103;
  encoded.push(checksum);
  encoded.push(STOP);
  
  // Convert to barcode pattern
  let pattern = "";
  for (let code of encoded) {
    pattern += CODE128_PATTERNS[code] || "";
  }
  
  // Generate SVG (each 1 = 2px, each 0 = 1px white)
  const barHeight = 60;
  let svg = `<svg width="${pattern.length * 2}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">`;
  let x = 0;
  
  for (let bit of pattern) {
    const width = bit === "1" ? 2 : 1;
    if (bit === "1") {
      svg += `<rect x="${x}" y="0" width="${width}" height="${barHeight}" fill="black"/>`;
    }
    x += width;
  }
  
  svg += `</svg>`;
  return svg;
};

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
              {/* Generated SVG Barcode */}
              <BarcodeDisplay barcode={barcode} />
              <p className="text-sm font-mono text-slate-700 mt-3">{barcode}</p>
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