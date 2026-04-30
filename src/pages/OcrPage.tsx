import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, ScanText, Upload, Save } from "lucide-react";
import { logAudit } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

const OcrPage = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setAnalyzing(true);
    setExtractedText("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("ocr-extract", {
        body: { imageBase64: base64, fileName: file.name, mimeType: file.type },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setExtractedText(data.text || "");
      toast({ title: "Texto extraído com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro no OCR", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!user || !extractedText) return;
    setSaving(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(extractedText);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { error } = await supabase.from("evidences").insert({
        user_id: user.id,
        module: "ocr",
        title: `OCR: ${file?.name || "documento"}`,
        input_content: `Arquivo: ${file?.name || "N/A"}\nTipo: ${file?.type || "N/A"}`,
        result_content: extractedText,
        file_hash: hash,
        case_id: caseId,
      });

      if (error) throw error;
      toast({ title: "Evidência salva na cadeia de custódia!" });
      await logAudit("ocr_saved", "ocr");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <ScanText className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">OCR — Extração de Texto</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Extraia texto de imagens e documentos digitalizados usando IA.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">Upload de Imagem / PDF</label>
            <div className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFile}
                className="hidden"
                id="ocr-file"
              />
              <label htmlFor="ocr-file" className="cursor-pointer text-sm text-primary hover:underline">
                {file ? file.name : "Selecionar arquivo"}
              </label>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF — até 10MB</p>
            </div>

            {preview && (
              <img src={preview} alt="Preview" className="mt-4 rounded-lg border border-border/50 max-h-64 mx-auto" />
            )}

            <CaseSelector value={caseId} onChange={setCaseId} />

            <Button onClick={handleExtract} disabled={!file || analyzing} className="mt-4 w-full gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
              {analyzing ? "Extraindo texto..." : "Extrair Texto (OCR)"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-xl p-6">
            <label className="block text-sm font-medium text-foreground mb-2">Texto Extraído</label>
            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="O texto extraído aparecerá aqui..."
              rows={16}
              className="bg-muted/30 border-border/60 font-mono text-sm"
            />
            {extractedText && (
              <Button onClick={handleSave} disabled={saving} className="mt-3 w-full gap-2" variant="outline">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar como Evidência
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrPage;
