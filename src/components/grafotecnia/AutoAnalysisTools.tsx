import { useState, useRef, useEffect, useCallback } from "react";
import { Wand2, BarChart3, Contrast, Maximize, Grid3X3, Sparkles, Download, RotateCcw, Car, Layers, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { uploadCanvasAsEvidence } from "@/lib/evidence-images";
import { logAudit } from "@/lib/audit";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImageEntry {
  id: string;
  base64: string;
  preview: string;
  label: "padrao" | "questionada";
  fileName: string;
}

interface Props {
  images: ImageEntry[];
}

type AnalysisType =
  | "original"
  | "edges"
  | "histogram"
  | "equalize"
  | "sharpen"
  | "erosion"
  | "dilation"
  | "channels_r"
  | "channels_g"
  | "channels_b"
  | "grayscale"
  | "skeleton"
  | "plate_enhance"
  | "overlay";

const ANALYSES: { id: AnalysisType; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "original", label: "Original", icon: <RotateCcw className="h-3.5 w-3.5" />, description: "Imagem sem processamento" },
  { id: "edges", label: "Detecção de Bordas", icon: <Grid3X3 className="h-3.5 w-3.5" />, description: "Sobel — destaca contornos e traços da escrita" },
  { id: "equalize", label: "Realce de Contraste", icon: <Contrast className="h-3.5 w-3.5" />, description: "Equalização de histograma — melhora visibilidade de traços fracos" },
  { id: "sharpen", label: "Nitidez (Unsharp Mask)", icon: <Sparkles className="h-3.5 w-3.5" />, description: "Realça detalhes finos como ataques e remates" },
  { id: "erosion", label: "Erosão", icon: <Maximize className="h-3.5 w-3.5" />, description: "Remove pixels das bordas — isola o esqueleto do traço" },
  { id: "dilation", label: "Dilatação", icon: <Maximize className="h-3.5 w-3.5" />, description: "Expande bordas — evidencia pressão e espessura do traço" },
  { id: "skeleton", label: "Esqueletização", icon: <Wand2 className="h-3.5 w-3.5" />, description: "Reduz traço a 1px de largura — análise do gesto gráfico" },
  { id: "grayscale", label: "Escala de Cinza", icon: <Contrast className="h-3.5 w-3.5" />, description: "Conversão para tons de cinza" },
  { id: "channels_r", label: "Canal Vermelho", icon: <BarChart3 className="h-3.5 w-3.5" />, description: "Isola canal R — diferencia tintas e pressão" },
  { id: "channels_g", label: "Canal Verde", icon: <BarChart3 className="h-3.5 w-3.5" />, description: "Isola canal G — revela alterações químicas" },
  { id: "channels_b", label: "Canal Azul", icon: <BarChart3 className="h-3.5 w-3.5" />, description: "Isola canal B — distingue tipos de tinta" },
  { id: "histogram", label: "Histograma", icon: <BarChart3 className="h-3.5 w-3.5" />, description: "Distribuição de intensidades — análise quantitativa" },
  { id: "plate_enhance", label: "Realce de Placa", icon: <Car className="h-3.5 w-3.5" />, description: "Realce forense de placas de veículos — CLAHE + Unsharp + Deconvolução iterativa" },
  { id: "overlay", label: "Sobreposição", icon: <Layers className="h-3.5 w-3.5" />, description: "Sobrepor duas imagens com controle de opacidade para comparação" },
];

// --- Image processing functions ---

function toGrayscale(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = g;
  }
}

function sobelEdges(src: ImageData, dst: ImageData) {
  const w = src.width, h = src.height;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * src.data[i * 4] + 0.587 * src.data[i * 4 + 1] + 0.114 * src.data[i * 4 + 2];
  }
  const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sx = 0, sy = 0, ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * w + (x + kx)];
          sx += val * Gx[ki];
          sy += val * Gy[ki];
          ki++;
        }
      }
      const mag = Math.min(255, Math.sqrt(sx * sx + sy * sy));
      const idx = (y * w + x) * 4;
      dst.data[idx] = dst.data[idx + 1] = dst.data[idx + 2] = mag;
      dst.data[idx + 3] = 255;
    }
  }
}

function equalizeHistogram(data: Uint8ClampedArray) {
  const hist = new Array(256).fill(0);
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[g]++;
  }
  const cdf = new Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
  const cdfMin = cdf.find((v) => v > 0) || 0;
  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(((cdf[i] - cdfMin) / (total - cdfMin)) * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const mapped = lut[g];
    const ratio = g > 0 ? mapped / g : 1;
    data[i] = Math.min(255, data[i] * ratio);
    data[i + 1] = Math.min(255, data[i + 1] * ratio);
    data[i + 2] = Math.min(255, data[i + 2] * ratio);
  }
}

function unsharpMask(src: ImageData, amount: number = 1.5) {
  const w = src.width, h = src.height;
  const blurred = new Float32Array(w * h * 4);
  // Simple 3x3 box blur
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            sum += src.data[((y + ky) * w + (x + kx)) * 4 + c];
        blurred[(y * w + x) * 4 + c] = sum / 9;
      }
    }
  }
  for (let i = 0; i < src.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      src.data[i + c] = Math.min(255, Math.max(0, src.data[i + c] + amount * (src.data[i + c] - blurred[i + c])));
    }
  }
}

function morphOp(src: ImageData, erode: boolean) {
  const w = src.width, h = src.height;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = src.data[i * 4] < 128 ? 0 : 255;
  }
  const out = new Uint8Array(gray);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let val = erode ? 255 : 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const g = gray[(y + ky) * w + (x + kx)];
          val = erode ? Math.min(val, g) : Math.max(val, g);
        }
      }
      out[y * w + x] = val;
    }
  }
  for (let i = 0; i < out.length; i++) {
    src.data[i * 4] = src.data[i * 4 + 1] = src.data[i * 4 + 2] = out[i];
  }
}

function skeletonize(src: ImageData) {
  const w = src.width, h = src.height;
  // Binarize first
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) {
    const g = 0.299 * src.data[i * 4] + 0.587 * src.data[i * 4 + 1] + 0.114 * src.data[i * 4 + 2];
    bin[i] = g < 128 ? 1 : 0; // foreground = 1
  }

  // Zhang-Suen thinning
  let changed = true;
  const mark = new Uint8Array(w * h);
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      mark.fill(0);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!bin[y * w + x]) continue;
          const p2 = bin[(y - 1) * w + x];
          const p3 = bin[(y - 1) * w + (x + 1)];
          const p4 = bin[y * w + (x + 1)];
          const p5 = bin[(y + 1) * w + (x + 1)];
          const p6 = bin[(y + 1) * w + x];
          const p7 = bin[(y + 1) * w + (x - 1)];
          const p8 = bin[y * w + (x - 1)];
          const p9 = bin[(y - 1) * w + (x - 1)];

          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;

          const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let i = 0; i < 8; i++) {
            if (neighbors[i] === 0 && neighbors[i + 1] === 1) A++;
          }
          if (A !== 1) continue;

          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          mark[y * w + x] = 1;
          changed = true;
        }
      }
      for (let i = 0; i < mark.length; i++) {
        if (mark[i]) bin[i] = 0;
      }
    }
  }

  // Write result - skeleton in primary color on dark bg
  for (let i = 0; i < bin.length; i++) {
    if (bin[i]) {
      src.data[i * 4] = 255;
      src.data[i * 4 + 1] = 140;
      src.data[i * 4 + 2] = 0;
    } else {
      src.data[i * 4] = src.data[i * 4 + 1] = src.data[i * 4 + 2] = 15;
    }
    src.data[i * 4 + 3] = 255;
  }
}

function extractChannel(data: Uint8ClampedArray, channel: 0 | 1 | 2) {
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i + channel];
    data[i] = channel === 0 ? val : 0;
    data[i + 1] = channel === 1 ? val : 0;
    data[i + 2] = channel === 2 ? val : 0;
  }
}

function computeHistogram(data: Uint8ClampedArray): number[] {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[g]++;
  }
  return hist;
}

// CLAHE-inspired local contrast + iterative deconvolution for plate enhancement
function plateEnhance(src: ImageData) {
  const w = src.width, h = src.height;
  const data = src.data;

  // Step 1: Convert to grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // Step 2: CLAHE-like local contrast enhancement (tile-based)
  const tileSize = 32;
  const enhanced = new Float32Array(gray);
  for (let ty = 0; ty < h; ty += tileSize) {
    for (let tx = 0; tx < w; tx += tileSize) {
      const tw = Math.min(tileSize, w - tx);
      const th = Math.min(tileSize, h - ty);
      let min = 255, max = 0;
      for (let y = ty; y < ty + th; y++) {
        for (let x = tx; x < tx + tw; x++) {
          const v = gray[y * w + x];
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      const range = max - min || 1;
      for (let y = ty; y < ty + th; y++) {
        for (let x = tx; x < tx + tw; x++) {
          enhanced[y * w + x] = ((gray[y * w + x] - min) / range) * 255;
        }
      }
    }
  }

  // Step 3: Strong unsharp mask (deconvolution approximation)
  const sharpened = new Float32Array(enhanced);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let blur = 0, count = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          blur += enhanced[(y + ky) * w + (x + kx)];
          count++;
        }
      }
      blur /= count;
      sharpened[y * w + x] = Math.min(255, Math.max(0, enhanced[y * w + x] + 2.5 * (enhanced[y * w + x] - blur)));
    }
  }

  // Step 4: Adaptive thresholding to isolate characters
  for (let i = 0; i < sharpened.length; i++) {
    const val = Math.round(sharpened[i]);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }
}

const AutoAnalysisTools = ({ images }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const histCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [overlayImage, setOverlayImage] = useState<string>("");
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayScale, setOverlayScale] = useState(100);
  const [overlayOffsetX, setOverlayOffsetX] = useState(0);
  const [overlayOffsetY, setOverlayOffsetY] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisType>("original");
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [sharpenAmount, setSharpenAmount] = useState(1.5);
  const [imageRotation, setImageRotation] = useState(0);

  // Auto-select first image
  useEffect(() => {
    if (!selectedImage && images.length > 0) setSelectedImage(images[0].id);
  }, [images]);

  // Auto-select overlay image
  useEffect(() => {
    if (!overlayImage && images.length > 1) {
      const other = images.find((i) => i.id !== selectedImage);
      if (other) setOverlayImage(other.id);
    }
  }, [images, selectedImage]);

  // Load images
  useEffect(() => {
    images.forEach((img) => {
      if (!loadedImages[img.id]) {
        const el = new Image();
        el.onload = () => setLoadedImages((prev) => ({ ...prev, [img.id]: el }));
        el.src = img.base64;
      }
    });
  }, [images]);

  const processAndDraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImages[selectedImage];
    if (!canvas || !img) return;

    // Overlay mode: draw two images
    if (analysis === "overlay") {
      const img2 = loadedImages[overlayImage];
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      if (img2) {
        ctx.save();
        ctx.globalAlpha = overlayOpacity / 100;
        const cx = img.width / 2 + overlayOffsetX;
        const cy = img.height / 2 + overlayOffsetY;
        ctx.translate(cx, cy);
        ctx.rotate((overlayRotation * Math.PI) / 180);
        ctx.scale(overlayScale / 100, overlayScale / 100);
        ctx.drawImage(img2, -img.width / 2, -img.height / 2, img.width, img.height);
        ctx.restore();
      }
      return;
    }

    // Apply rotation to base image
    const rad = (imageRotation * Math.PI) / 180;
    const absC = Math.abs(Math.cos(rad));
    const absS = Math.abs(Math.sin(rad));
    const rw = Math.ceil(img.width * absC + img.height * absS);
    const rh = Math.ceil(img.width * absS + img.height * absC);
    canvas.width = rw;
    canvas.height = rh;
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(rw / 2, rh / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    if (analysis === "original") return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    switch (analysis) {
      case "edges": {
        const dst = ctx.createImageData(canvas.width, canvas.height);
        sobelEdges(imgData, dst);
        ctx.putImageData(dst, 0, 0);
        break;
      }
      case "equalize":
        equalizeHistogram(imgData.data);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "sharpen":
        unsharpMask(imgData, sharpenAmount);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "erosion":
        toGrayscale(imgData.data);
        morphOp(imgData, true);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "dilation":
        toGrayscale(imgData.data);
        morphOp(imgData, false);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "skeleton":
        skeletonize(imgData);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "grayscale":
        toGrayscale(imgData.data);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "channels_r":
        extractChannel(imgData.data, 0);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "channels_g":
        extractChannel(imgData.data, 1);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "channels_b":
        extractChannel(imgData.data, 2);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "plate_enhance":
        plateEnhance(imgData);
        ctx.putImageData(imgData, 0, 0);
        break;
      case "histogram": {
        const hist = computeHistogram(imgData.data);
        ctx.putImageData(imgData, 0, 0);
        drawHistogram(hist);
        break;
      }
    }
  }, [selectedImage, analysis, loadedImages, sharpenAmount, overlayImage, overlayOpacity, overlayRotation, overlayScale, overlayOffsetX, overlayOffsetY, imageRotation]);

  useEffect(() => {
    processAndDraw();
  }, [processAndDraw]);

  const drawHistogram = (hist: number[]) => {
    const hc = histCanvasRef.current;
    if (!hc) return;
    hc.width = 256;
    hc.height = 120;
    const ctx = hc.getContext("2d")!;
    ctx.fillStyle = "rgba(15,15,15,0.9)";
    ctx.fillRect(0, 0, 256, 120);
    const max = Math.max(...hist);
    ctx.fillStyle = "hsl(30, 90%, 50%)";
    for (let i = 0; i < 256; i++) {
      const h = (hist[i] / max) * 110;
      ctx.fillRect(i, 120 - h, 1, h);
    }
    ctx.fillStyle = "#aaa";
    ctx.font = "9px sans-serif";
    ctx.fillText("0", 2, 116);
    ctx.fillText("255", 232, 116);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    const img = images.find((i) => i.id === selectedImage);
    const suffix = analysis === "original" ? "" : `_${analysis}`;
    link.download = `${img?.fileName || "analise"}${suffix}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const [savingCanvas, setSavingCanvas] = useState(false);

  const handleSaveCanvasToCustody = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingCanvas(true);
    try {
      const img = images.find((i) => i.id === selectedImage);
      const suffix = analysis === "original" ? "" : `_${analysis}`;
      const fileName = `${img?.fileName || "analise"}${suffix}.png`;

      const result = await uploadCanvasAsEvidence({
        canvas,
        fileName,
        module: "grafotecnia",
        label: `processamento_${analysis}`,
      });

      if (result) {
        await logAudit("image_preserved", "grafotecnia", {
          storagePath: result.path,
          hash: result.hash,
          analysisType: analysis,
          originalFile: img?.fileName,
        });
        toast({
          title: "Imagem preservada na cadeia de custódia",
          description: `Hash SHA-256: ${result.hash.substring(0, 16)}...`,
        });
      } else {
        toast({ title: "Erro ao preservar imagem", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSavingCanvas(false);
  };

  const currentAnalysis = ANALYSES.find((a) => a.id === analysis);

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            Análise Automatizada de Imagem
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Processamento científico com um clique — técnicas baseadas no ImageJ
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={handleSaveCanvasToCustody} disabled={savingCanvas} className="h-7 px-2 text-xs gap-1">
            {savingCanvas ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Preservar na custódia
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 px-2 text-xs gap-1">
            <Download className="h-3 w-3" /> Exportar
          </Button>
        </div>
      </div>

      {/* Image selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Imagem:</span>
        <Select value={selectedImage} onValueChange={setSelectedImage}>
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {images.map((img) => (
              <SelectItem key={img.id} value={img.id} className="text-xs">
                {img.fileName} ({img.label === "padrao" ? "Padrão" : "Questionada"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Analysis buttons */}
      <div className="flex flex-wrap gap-1.5">
        {ANALYSES.map((a) => (
          <Button
            key={a.id}
            variant={analysis === a.id ? "default" : "outline"}
            size="sm"
            onClick={() => setAnalysis(a.id)}
            className="h-7 px-2.5 text-[11px] gap-1"
            title={a.description}
          >
            {a.icon} {a.label}
          </Button>
        ))}
      </div>

      {/* Description */}
      {currentAnalysis && (
        <div className="text-xs bg-muted/40 rounded px-3 py-1.5 text-muted-foreground">
          ℹ️ {currentAnalysis.description}
        </div>
      )}

      {/* Sharpen amount slider */}
      {analysis === "sharpen" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Intensidade:</span>
          <Slider
            value={[sharpenAmount]}
            onValueChange={([v]) => setSharpenAmount(v)}
            min={0.5}
            max={5}
            step={0.1}
            className="w-32"
          />
          <span className="text-muted-foreground">{sharpenAmount.toFixed(1)}</span>
        </div>
      )}

      {/* Rotation control (non-overlay) */}
      {analysis !== "overlay" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Rotação:</span>
          <Slider
            value={[imageRotation]}
            onValueChange={([v]) => setImageRotation(v)}
            min={-180}
            max={180}
            step={0.5}
            className="w-40"
          />
          <span className="text-muted-foreground w-12 text-right">{imageRotation.toFixed(1)}°</span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setImageRotation(0)}>Reset</Button>
        </div>
      )}

      {/* Overlay controls */}
      {analysis === "overlay" && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Sobrepor com:</span>
              <Select value={overlayImage} onValueChange={setOverlayImage}>
                <SelectTrigger className="h-7 text-xs w-48">
                  <SelectValue placeholder="Selecione a 2ª imagem" />
                </SelectTrigger>
                <SelectContent>
                  {images.filter((i) => i.id !== selectedImage).map((img) => (
                    <SelectItem key={img.id} value={img.id} className="text-xs">
                      {img.fileName} ({img.label === "padrao" ? "Padrão" : "Questionada"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Opacidade:</span>
              <Slider value={[overlayOpacity]} onValueChange={([v]) => setOverlayOpacity(v)} min={0} max={100} step={1} className="w-28" />
              <span className="text-muted-foreground w-8">{overlayOpacity}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rotação:</span>
              <Slider value={[overlayRotation]} onValueChange={([v]) => setOverlayRotation(v)} min={-180} max={180} step={0.5} className="w-28" />
              <span className="text-muted-foreground w-10">{overlayRotation.toFixed(1)}°</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Escala:</span>
              <Slider value={[overlayScale]} onValueChange={([v]) => setOverlayScale(v)} min={10} max={200} step={1} className="w-28" />
              <span className="text-muted-foreground w-8">{overlayScale}%</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Deslocamento X:</span>
              <Slider value={[overlayOffsetX]} onValueChange={([v]) => setOverlayOffsetX(v)} min={-500} max={500} step={1} className="w-28" />
              <span className="text-muted-foreground w-10">{overlayOffsetX}px</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Deslocamento Y:</span>
              <Slider value={[overlayOffsetY]} onValueChange={([v]) => setOverlayOffsetY(v)} min={-500} max={500} step={1} className="w-28" />
              <span className="text-muted-foreground w-10">{overlayOffsetY}px</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => { setOverlayRotation(0); setOverlayScale(100); setOverlayOffsetX(0); setOverlayOffsetY(0); }}>
              Reset posição
            </Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border border-border/50 rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center"
        style={{ minHeight: 300, maxHeight: 500 }}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[500px] object-contain"
        />
      </div>

      {/* Histogram canvas */}
      {analysis === "histogram" && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Histograma de Intensidades</span>
          <canvas ref={histCanvasRef} className="rounded border border-border/50" style={{ width: 256, height: 120 }} />
        </div>
      )}
    </div>
  );
};

export default AutoAnalysisTools;
