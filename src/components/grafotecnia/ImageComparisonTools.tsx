import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Layers, Ruler, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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

type Tool = "pan" | "measure";

const ImageComparisonTools = ({ images }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("pan");
  const [overlayMode, setOverlayMode] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [selectedPadrao, setSelectedPadrao] = useState<string>("");
  const [selectedQuestionada, setSelectedQuestionada] = useState<string>("");
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [binarize, setBinarize] = useState(false);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);

  const padraoImages = images.filter((i) => i.label === "padrao");
  const questionadaImages = images.filter((i) => i.label === "questionada");

  // Auto-select first images
  useEffect(() => {
    if (!selectedPadrao && padraoImages.length > 0) setSelectedPadrao(padraoImages[0].id);
    if (!selectedQuestionada && questionadaImages.length > 0) setSelectedQuestionada(questionadaImages[0].id);
  }, [images]);

  // Load images
  useEffect(() => {
    const toLoad = images.filter((i) => !loadedImages[i.id]);
    toLoad.forEach((img) => {
      const el = new Image();
      el.onload = () => setLoadedImages((prev) => ({ ...prev, [img.id]: el }));
      el.src = img.base64;
    });
  }, [images]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const applyFilters = (imgData: ImageData) => {
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (binarize) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = gray > threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = invert ? 255 - val : val;
        } else if (invert) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
      }
      return imgData;
    };

    if (overlayMode) {
      const imgP = loadedImages[selectedPadrao];
      const imgQ = loadedImages[selectedQuestionada];
      if (imgP) {
        ctx.globalAlpha = 1;
        ctx.drawImage(imgP, 0, 0);
        if (binarize || invert) {
          const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
          ctx.putImageData(applyFilters(d), 0, 0);
        }
      }
      if (imgQ) {
        ctx.globalAlpha = overlayOpacity / 100;
        ctx.drawImage(imgQ, 0, 0);
      }
      ctx.globalAlpha = 1;
    } else {
      // Side by side
      const imgP = loadedImages[selectedPadrao];
      const imgQ = loadedImages[selectedQuestionada];
      const halfW = canvas.width / zoom / 2 - 10;

      if (imgP) {
        const scale = Math.min(halfW / imgP.width, (canvas.height / zoom) / imgP.height);
        ctx.drawImage(imgP, 0, 0, imgP.width * scale, imgP.height * scale);

        ctx.fillStyle = "#22c55e";
        ctx.font = "12px sans-serif";
        ctx.fillText("PADRÃO", 4, 14);
      }
      if (imgQ) {
        const offsetX = halfW + 20;
        const scale = Math.min(halfW / imgQ.width, (canvas.height / zoom) / imgQ.height);
        ctx.drawImage(imgQ, offsetX, 0, imgQ.width * scale, imgQ.height * scale);

        ctx.fillStyle = "#f59e0b";
        ctx.font = "12px sans-serif";
        ctx.fillText("QUESTIONADA", offsetX + 4, 14);
      }
    }

    // Draw measure line
    if (measurePoints.length === 2) {
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      const [a, b] = measurePoints;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // endpoints
      [a, b].forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      });
    }

    ctx.restore();
  }, [zoom, panOffset, overlayMode, overlayOpacity, selectedPadrao, selectedQuestionada, loadedImages, binarize, threshold, invert, measurePoints]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.2, Math.min(8, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    } else if (tool === "measure") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setMeasurePoints((prev) => {
        if (prev.length >= 2) return [pt];
        const next = [...prev, pt];
        if (next.length === 2) {
          const dx = next[1].x - next[0].x;
          const dy = next[1].y - next[0].y;
          const dist = Math.sqrt(dx * dx + dy * dy) / zoom;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          setMeasureResult(`Distância: ${dist.toFixed(1)}px | Ângulo: ${angle.toFixed(1)}°`);
        }
        return next;
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setMeasurePoints([]);
    setMeasureResult(null);
  };

  if (images.length < 2) {
    return (
      <div className="glass-card rounded-xl p-5 text-center text-muted-foreground text-sm">
        Envie ao menos uma imagem padrão e uma questionada para usar as ferramentas de comparação.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-sm font-semibold text-foreground">Ferramentas de Comparação</h3>
        <div className="flex gap-1">
          <Button
            variant={tool === "pan" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("pan")}
            className="h-7 px-2 text-xs gap-1"
          >
            <Move className="h-3 w-3" /> Pan
          </Button>
          <Button
            variant={tool === "measure" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("measure")}
            className="h-7 px-2 text-xs gap-1"
          >
            <Ruler className="h-3 w-3" /> Medir
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOverlayMode(!overlayMode)} className="h-7 px-2 text-xs gap-1">
            <Layers className="h-3 w-3" /> {overlayMode ? "Lado a lado" : "Sobreposição"}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom((z) => Math.min(8, z + 0.2))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={resetView}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>

        {overlayMode && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Opacidade:</span>
            <Slider
              value={[overlayOpacity]}
              onValueChange={([v]) => setOverlayOpacity(v)}
              min={0}
              max={100}
              step={1}
              className="w-24"
            />
            <span className="text-muted-foreground">{overlayOpacity}%</span>
          </div>
        )}

        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={binarize} onChange={(e) => setBinarize(e.target.checked)} className="rounded" />
          <span className="text-muted-foreground">Binarizar</span>
        </label>

        {binarize && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Limiar:</span>
            <Slider value={[threshold]} onValueChange={([v]) => setThreshold(v)} min={0} max={255} step={1} className="w-20" />
            <span className="text-muted-foreground">{threshold}</span>
          </div>
        )}

        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="rounded" />
          <span className="text-muted-foreground">Inverter</span>
        </label>
      </div>

      {/* Image selectors */}
      <div className="flex gap-3 flex-wrap">
        {padraoImages.length > 1 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-600/20 text-green-400 border-green-600/40 text-[10px]">Padrão</Badge>
            <Select value={selectedPadrao} onValueChange={setSelectedPadrao}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {padraoImages.map((i) => (
                  <SelectItem key={i.id} value={i.id} className="text-xs">{i.fileName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {questionadaImages.length > 1 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-600/20 text-amber-400 border-amber-600/40 text-[10px]">Questionada</Badge>
            <Select value={selectedQuestionada} onValueChange={setSelectedQuestionada}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {questionadaImages.map((i) => (
                  <SelectItem key={i.id} value={i.id} className="text-xs">{i.fileName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {measureResult && (
        <div className="text-xs bg-muted/40 rounded px-3 py-1.5 text-foreground font-mono">
          📏 {measureResult}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border border-border/50 rounded-lg overflow-hidden bg-muted/20"
        style={{ height: 380, cursor: tool === "pan" ? "grab" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default ImageComparisonTools;
