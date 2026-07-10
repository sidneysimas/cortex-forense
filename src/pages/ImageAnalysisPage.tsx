import { useState, useRef } from "react";
import { Upload, Loader2, Camera, Copy, Check, Save, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { saveEvidence } from "@/lib/audit";
import { uploadEvidenceImages } from "@/lib/evidence-images";
import CaseSelector from "@/components/dashboard/CaseSelector";

const analysisTypes = [
  { value: "geral", label: "Análise Geral" },
  { value: "imovel", label: "Avaliação de Imóvel" },
  { value: "acidente", label: "Acidente de Trânsito" },
  { value: "grafotecnia", label: "Grafotecnia / Assinatura" },
  { value: "documento", label: "Documentoscopia" },
];

const ImageAnalysisPage = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [analysisType, setAnalysisType] = useState("geral");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      toast({ title: "Atenção", description: "Envie uma imagem para análise.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageBase64, context, analysisType }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro na análise" }));
        throw new Error(err.error || "Erro na análise");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setResult(full);
            }
          } catch { /* partial */ }
        }
      }

      setResult(full);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload image to storage for chain of custody preservation
      let uploadedImages: { path: string; hash: string; url: string; fileName: string }[] = [];
      if (imageBase64) {
        uploadedImages = await uploadEvidenceImages({
          images: [{ base64: imageBase64, fileName: `imagem_pericial_${Date.now()}.png` }],
          module: "analise-imagem",
        });
      }

      await saveEvidence({
        module: "analise-imagem",
        title: `Análise de Imagem (${analysisTypes.find(t => t.value === analysisType)?.label}) — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        inputContent: context || "Imagem pericial",
        resultContent: result,
        caseId: selectedCase !== "none" ? selectedCase : undefined,
        metadata: {
          analysisType,
          preservedImages: uploadedImages.map(img => ({
            storagePath: img.path,
            hash: img.hash,
            url: img.url,
            fileName: img.fileName,
          })),
          preservationMethod: "Imagem armazenada em bucket criptografado com hash SHA-256 — ABNT NBR ISO/IEC 27037:2013",
        },
      });
      toast({ title: "Evidência salva na cadeia de custódia!", description: `${uploadedImages.length} imagem(ns) preservada(s).` });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Análise de Imagens Periciais</h1>
      <p className="text-muted-foreground mb-6">
        Envie fotos da perícia e receba descrições técnicas detalhadas prontas para o laudo.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger className="bg-muted/30 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {analysisTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

            {!imagePreview ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border/60 rounded-xl p-10 text-center hover:border-primary/50 transition-colors"
              >
                <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Clique para enviar uma imagem</p>
                <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP — máx. 10MB</p>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-[300px] object-contain bg-muted/20" />
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
                  <Upload className="h-3.5 w-3.5" /> Trocar imagem
                </Button>
              </div>
            )}

            <Textarea
              placeholder="Contexto adicional (opcional): descreva o caso, local, circunstâncias..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[80px] bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground resize-none"
            />

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            <Button onClick={handleAnalyze} disabled={loading || !imageBase64} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : <><ImageIcon className="h-4 w-4" /> Analisar Imagem</>}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Descrição Técnica</h3>
            <div className="flex gap-1">
              {result && !loading && (
                <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} className="text-muted-foreground hover:text-foreground gap-1.5 h-8">
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
          <div className="min-h-[200px] max-h-[500px] overflow-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {result || (
              <span className="text-muted-foreground italic">
                {loading ? "Analisando imagem com IA..." : "O resultado aparecerá aqui após a análise."}
              </span>
            )}
            {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysisPage;
