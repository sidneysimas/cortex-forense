import { useState, useRef } from "react";
import { Upload, Loader2, FileText, Copy, Check, Save, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { saveEvidence, logAudit } from "@/lib/audit";
import { uploadEvidenceImages } from "@/lib/evidence-images";
import CaseSelector from "@/components/dashboard/CaseSelector";
import { Badge } from "@/components/ui/badge";
import ImageComparisonTools from "@/components/grafotecnia/ImageComparisonTools";
import ImageJPanel from "@/components/grafotecnia/ImageJPanel";
import AutoAnalysisTools from "@/components/grafotecnia/AutoAnalysisTools";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ImageEntry = {
  id: string;
  base64: string;
  preview: string;
  label: "padrao" | "questionada";
  fileName: string;
};

const LABELS: Record<string, { text: string; color: string }> = {
  padrao: { text: "Padrão (Autêntica)", color: "bg-green-600/20 text-green-400 border-green-600/40" },
  questionada: { text: "Questionada", color: "bg-amber-600/20 text-amber-400 border-amber-600/40" },
};

const GrafotecniaPage = () => {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setImages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            base64,
            preview: base64,
            label: prev.some((i) => i.label === "padrao") ? "questionada" : "padrao",
            fileName: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const updateLabel = (id: string, label: "padrao" | "questionada") => {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, label } : i)));
  };

  const handleAnalyze = async () => {
    if (!content.trim() && images.length === 0) {
      toast({ title: "Atenção", description: "Forneça contexto ou imagens para análise.", variant: "destructive" });
      return;
    }

    if (images.length > 0 && images.length < 2) {
      toast({
        title: "Recomendação",
        description: "Para comparação grafotécnica, envie ao menos uma assinatura padrão e uma questionada.",
      });
    }

    setLoading(true);
    setResult("");
    await logAudit("analysis_started", "grafotecnia", { contentLength: content.length, imageCount: images.length });

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forensic-analysis`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: "grafotecnia",
          content: content.trim(),
          images: images.map((i) => ({ base64: i.base64, label: i.label, fileName: i.fileName })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro na análise" }));
        toast({ title: "Erro na análise", description: err.error || `Erro ${resp.status}`, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!resp.body) {
        toast({ title: "Erro", description: "Sem resposta do servidor", variant: "destructive" });
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResult = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              fullResult += c;
              setResult((prev) => prev + c);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setResult(fullResult);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha na requisição", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEvidence = async () => {
    setSaving(true);
    try {
      // Upload images to forensic-files storage bucket (chain of custody)
      const uploadedImages = await uploadEvidenceImages({
        images: images.map((img) => ({
          base64: img.base64,
          fileName: img.fileName,
          label: img.label,
        })),
        module: "grafotecnia",
      });

      await saveEvidence({
        module: "grafotecnia",
        title: `Grafotecnia — ${new Date().toLocaleString("pt-BR")}`,
        inputContent: content,
        resultContent: result,
        caseId: selectedCase !== "none" ? selectedCase : undefined,
        metadata: {
          grafotecniaImages: uploadedImages.map((img) => ({
            storagePath: img.path,
            hash: img.hash,
            url: img.url,
            label: img.label,
            fileName: img.fileName,
          })),
          imageCount: uploadedImages.length,
          preservationMethod: "Imagens armazenadas em bucket criptografado com hash SHA-256 individual — ABNT NBR ISO/IEC 27037:2013",
        },
      });
      toast({ title: "Evidência salva na cadeia de custódia!", description: `${uploadedImages.length} imagem(ns) preservada(s) com hash SHA-256.` });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const padraoCount = images.filter((i) => i.label === "padrao").length;
  const questionadaCount = images.filter((i) => i.label === "questionada").length;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Grafotecnia</h1>
      <p className="text-muted-foreground mb-6">
        Análise e comparação de assinaturas com inteligência artificial — baseada em metodologia de exame grafotécnico pericial.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Context */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <label className="text-sm font-medium text-foreground">Contexto da Análise</label>
            <Textarea
              placeholder="Descreva o contexto da análise grafotécnica (ex: comparação da assinatura do contrato X com a assinatura padrão coletada em cartório)..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Images */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Imagens para Comparação</label>
              <div className="flex gap-2 text-xs">
                {padraoCount > 0 && (
                  <Badge variant="outline" className={LABELS.padrao.color}>
                    {padraoCount} padrão
                  </Badge>
                )}
                {questionadaCount > 0 && (
                  <Badge variant="outline" className={LABELS.questionada.color}>
                    {questionadaCount} questionada
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Envie as assinaturas padrão (autênticas/de referência) e as assinaturas questionadas (em análise). A IA realizará a comparação segundo critérios grafotécnicos: pressão, velocidade, proporção, inclinação, ataques, remates e gesto gráfico.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImages}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="gap-2 border-border text-muted-foreground hover:text-foreground w-full"
            >
              <Upload className="h-4 w-4" />
              Adicionar imagens ({images.length}/10)
            </Button>

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-auto">
                {images.map((img) => (
                  <div key={img.id} className="relative rounded-lg border border-border/50 overflow-hidden group">
                    <img src={img.preview} alt={img.fileName} className="w-full h-32 object-contain bg-muted/20" />

                    <div className="p-2 space-y-1.5 bg-background/80">
                      <p className="text-[10px] text-muted-foreground truncate">{img.fileName}</p>
                      <Select value={img.label} onValueChange={(v) => updateLabel(img.id, v as any)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="padrao">
                            <span className="flex items-center gap-1.5">
                              <Tag className="h-3 w-3 text-green-400" /> Padrão (Autêntica)
                            </span>
                          </SelectItem>
                          <SelectItem value="questionada">
                            <span className="flex items-center gap-1.5">
                              <Tag className="h-3 w-3 text-amber-400" /> Questionada
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case & Analyze */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <CaseSelector value={selectedCase} onChange={setSelectedCase} />
            <Button onClick={handleAnalyze} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
              ) : (
                <><FileText className="h-4 w-4" /> Analisar Grafotecnia</>
              )}
            </Button>
          </div>
        </div>

        {/* Right panel - Result */}
        <div className="glass-card rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Resultado da Análise Grafotécnica</h3>
            <div className="flex gap-1">
              {result && !loading && (
                <Button variant="ghost" size="sm" onClick={handleSaveEvidence} disabled={saving} className="text-muted-foreground hover:text-foreground gap-1.5 h-8">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              )}
              {result && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="text-muted-foreground hover:text-foreground gap-1.5 h-8">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </div>
          </div>

          <div className="min-h-[200px] max-h-[600px] overflow-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {result || (
              <span className="text-muted-foreground italic">
                {loading ? "Processando análise grafotécnica..." : "O resultado aparecerá aqui. Envie ao menos uma assinatura padrão e uma questionada para comparação."}
              </span>
            )}
            {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </div>

      {/* Auto Analysis Tools */}
      {images.length >= 1 && (
        <div className="mt-6">
          <AutoAnalysisTools images={images} />
        </div>
      )}

      {/* Comparison Tools */}
      {images.length >= 2 && (
        <div className="mt-6">
          <ImageComparisonTools images={images} />
        </div>
      )}

      {/* ImageJ.JS Panel */}
      <div className="mt-6">
        <ImageJPanel />
      </div>
    </div>
  );
};

export default GrafotecniaPage;
