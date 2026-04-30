import { useState } from "react";
import { Loader2, Copy, Check, Save, FileQuestion, Search, MessageSquare, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { saveEvidence } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

const modes = [
  { value: "extract", label: "Extrair Quesitos", icon: Search, desc: "Identifica e numera quesitos de petições e despachos" },
  { value: "answer", label: "Responder Quesitos", icon: MessageSquare, desc: "Elabora respostas técnicas fundamentadas" },
  { value: "contestation", label: "Contestar Parecer", icon: Swords, desc: "Analisa e contesta laudos/pareceres contrários" },
];

const QuesitosPage = () => {
  const [content, setContent] = useState("");
  const [mode, setMode] = useState("extract");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast({ title: "Atenção", description: "Cole o conteúdo para análise.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-quesitos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ content, mode }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
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
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) { full += c; setResult(full); }
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
      const modeLabel = modes.find(m => m.value === mode)?.label || mode;
      await saveEvidence({
        module: "quesitos",
        title: `${modeLabel} — ${new Date().toLocaleString("pt-BR")}`,
        inputContent: content,
        resultContent: result,
        caseId: selectedCase !== "none" ? selectedCase : undefined,
      });
      toast({ title: "Evidência salva na cadeia de custódia!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Quesitos e Contestações</h1>
      <p className="text-muted-foreground mb-6">
        Extraia quesitos, elabore respostas técnicas ou conteste pareceres contrários com IA.
      </p>

      {/* Mode selector */}
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        {modes.map(m => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`glass-card rounded-xl p-4 text-left transition-all ${
              mode === m.value ? "border-primary/50 bg-primary/5" : "hover:bg-secondary"
            }`}
          >
            <m.icon className={`h-5 w-5 mb-2 ${mode === m.value ? "text-primary" : "text-muted-foreground"}`} />
            <p className={`text-sm font-medium ${mode === m.value ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <Textarea
            placeholder={
              mode === "extract"
                ? "Cole aqui o texto da petição, contestação ou despacho judicial..."
                : mode === "answer"
                ? "Cole aqui os quesitos que deseja responder..."
                : "Cole aqui o parecer ou laudo contrário que deseja contestar..."
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground resize-none"
          />
          <CaseSelector value={selectedCase} onChange={setSelectedCase} />
          <Button onClick={handleAnalyze} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : <><FileQuestion className="h-4 w-4" /> {modes.find(m => m.value === mode)?.label}</>}
          </Button>
        </div>

        <div className="glass-card rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Resultado</h3>
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
          <div className="min-h-[300px] max-h-[500px] overflow-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {result || (
              <span className="text-muted-foreground italic">
                {loading ? "Processando com IA..." : "O resultado aparecerá aqui após a análise."}
              </span>
            )}
            {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuesitosPage;
