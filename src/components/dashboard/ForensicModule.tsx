import { useState, useRef } from "react";
 import { Upload, Loader2, FileText, Copy, Check, Save, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { toast } from "@/hooks/use-toast";
import { saveEvidence } from "@/lib/audit";
import { logAudit } from "@/lib/audit";
 import CaseSelector from "./CaseSelector";
 import FileUploader from "./FileUploader";

interface Props {
  type: "grafotecnia" | "hives" | "documental" | "laudo";
  title: string;
  subtitle: string;
  placeholder: string;
  supportsImage?: boolean;
}

const ForensicModule = ({ type, title, subtitle, placeholder, supportsImage = false }: Props) => {
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
   const [copied, setCopied] = useState(false);
   const [saving, setSaving] = useState(false);
   const [selectedCase, setSelectedCase] = useState("none");
   const [filePath, setFilePath] = useState<string | null>(null);
   const [fileHash, setFileHash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!content.trim() && !imageBase64) {
      toast({ title: "Atenção", description: "Forneça conteúdo ou imagem para análise.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");
    await logAudit("analysis_started", type, { contentLength: content.length });

    let fullResult = "";
    await streamForensicAnalysis({
      type,
      content: content.trim(),
      imageBase64: imageBase64 || undefined,
      onDelta: (text) => {
        fullResult += text;
        setResult((prev) => prev + text);
      },
      onDone: () => {
        setLoading(false);
        setResult(fullResult);
      },
      onError: (err) => {
        setLoading(false);
        toast({ title: "Erro na análise", description: err, variant: "destructive" });
      },
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

   const handleSaveEvidence = async () => {
     setSaving(true);
     await saveEvidence({
       module: type,
       title: `${title} — ${new Date().toLocaleString("pt-BR")}`,
       inputContent: content,
       resultContent: result,
       filePath: filePath || undefined,
       fileHash: fileHash || undefined,
       caseId: selectedCase !== "none" ? selectedCase : undefined,
     });
     setSaving(false);
     toast({ title: "Evidência salva na cadeia de custódia!" });
   };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">{title}</h1>
      <p className="text-muted-foreground mb-6">{subtitle}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
             <div className="space-y-4">
               <div className="flex items-center justify-between mb-2">
                 <label className="text-sm font-semibold text-white/60">Conteúdo para Análise</label>
                 <span className="text-[10px] uppercase tracking-widest text-white/20">Input manual ou upload</span>
               </div>
               
               <Textarea
                 placeholder={placeholder}
                 value={content}
                 onChange={(e) => setContent(e.target.value)}
                 className="min-h-[200px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/20 resize-none rounded-2xl focus:border-primary/50 transition-all"
               />
 
               <div className="relative py-2">
                 <div className="absolute inset-0 flex items-center">
                   <span className="w-full border-t border-white/5" />
                 </div>
                 <div className="relative flex justify-center text-xs uppercase">
                   <span className="bg-[#050505] px-2 text-white/20 font-bold tracking-widest">OU</span>
                 </div>
               </div>
 
               <FileUploader 
                 moduleType={type}
                 onFileUploaded={(path, hash) => {
                   setFilePath(path);
                   setFileHash(hash);
                 }}
                 onFileRemoved={() => {
                   setFilePath(null);
                   setFileHash(null);
                 }}
                 label={type === 'hives' ? "Carregar Hive do Windows (SAM, SYSTEM, etc.)" : "Carregar arquivo para análise"}
               />
             </div>

            {supportsImage && (
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 border-border text-muted-foreground hover:text-foreground">
                  <Upload className="h-4 w-4" />
                  {imagePreview ? "Trocar imagem" : "Enviar imagem"}
                </Button>
                {imagePreview && (
                  <div className="mt-3 rounded-lg border border-border/50 overflow-hidden max-w-xs">
                    <img src={imagePreview} alt="Preview" className="w-full" />
                  </div>
                )}
              </div>
            )}

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            <Button onClick={handleAnalyze} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>) : (<><FileText className="h-4 w-4" /> Analisar com IA</>)}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Resultado da Análise</h3>
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

          <div className="min-h-[200px] max-h-[500px] overflow-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {result || (
              <span className="text-muted-foreground italic">
                {loading ? "Processando análise forense..." : "O resultado aparecerá aqui após a análise."}
              </span>
            )}
            {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForensicModule;
