import { useMemo, useRef, useState } from "react";
import { Loader2, Play, Save, Copy, Check, MapPin, Upload, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import CaseSelector from "@/components/dashboard/CaseSelector";
import GeoMap from "@/components/geo/GeoMap";
import {
  parseImageFile,
  buildGeoReport,
  type GeoExifRecord,
} from "@/lib/geo-forensics";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { saveEvidence, logAudit } from "@/lib/audit";

export default function GeoForensicsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [records, setRecords] = useState<GeoExifRecord[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");
  const inputRef = useRef<HTMLInputElement>(null);

  const report = useMemo(() => (records.length ? buildGeoReport(records) : null), [records]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|tiff?|webp)$/i.test(f.name)
    );
    if (list.length === 0) {
      toast({ title: "Nenhuma imagem válida", description: "Envie JPG, PNG, TIFF, HEIC ou WebP.", variant: "destructive" });
      return;
    }
    setFiles((prev) => [...prev, ...list]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (i: number) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const runParse = async () => {
    if (!files.length) {
      toast({ title: "Nenhum arquivo", description: "Envie ao menos uma imagem.", variant: "destructive" });
      return;
    }
    setParsing(true);
    setRecords([]);
    setAnalysis("");
    setProgress(0);
    const out: GeoExifRecord[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const rec = await parseImageFile(files[i]);
        out.push(rec);
      } catch (e) {
        console.error("parse fail", files[i].name, e);
      }
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }
    setRecords(out);
    setParsing(false);
    await logAudit("geo_forensics_parsed", "geo-forensics", {
      count: out.length,
      withGps: out.filter((r) => r.lat != null).length,
    });
    toast({
      title: "Extração concluída",
      description: `${out.length} imagem(ns) — ${out.filter((r) => r.lat != null).length} com GPS.`,
    });
  };

  const runAi = async () => {
    if (!report) return;
    setAnalyzing(true);
    setAnalysis("");
    const payload = JSON.stringify(report, null, 2);
    let full = "";
    await streamForensicAnalysis({
      type: "geo-forensics" as any,
      content: payload,
      onDelta: (t) => { full += t; setAnalysis((p) => p + t); },
      onDone: () => { setAnalyzing(false); setAnalysis(full); },
      onError: (err) => {
        setAnalyzing(false);
        toast({ title: "Erro na análise", description: err, variant: "destructive" });
      },
    });
  };

  const handleSave = async () => {
    if (!report || !analysis) return;
    setSaving(true);
    const combinedHash = records.map((r) => r.hash).join("|");
    await saveEvidence({
      module: "geo-forensics",
      title: `Geo Forense — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      inputContent: JSON.stringify(report, null, 2),
      resultContent: analysis,
      fileHash: combinedHash.length > 8 ? combinedHash : undefined,
      metadata: {
        files: records.map((r) => ({ name: r.fileName, sha256: r.hash, size: r.fileSize, lat: r.lat, lng: r.lng, takenAt: r.takenAt })),
      },
      caseId: selectedCase !== "none" ? selectedCase : undefined,
    });
    setSaving(false);
    toast({ title: "Evidência registrada na cadeia de custódia" });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const anomaliesList = records.filter((r) => r.anomalies.length > 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <MapPin className="h-6 w-6 text-yellow-400" />
        <h1 className="font-display text-2xl font-bold">Geo Forense (EXIF + Mapa)</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Extração local de metadados EXIF em lote, geolocalização em mapa interativo, timeline cronológica e detecção de anomalias.
        As imagens não saem do seu navegador — apenas o relatório estruturado (sem thumbnails) é enviado para a IA.
      </p>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
                Imagens ({files.length})
              </label>
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed border-white/10 rounded-xl px-4 py-8 text-center hover:border-primary/50 hover:bg-white/[0.02] transition-all"
              >
                <Upload className="h-8 w-8 text-white/30 mx-auto mb-2" />
                <p className="text-sm text-white/60">Clique para enviar imagens</p>
                <p className="text-[11px] text-white/30 mt-1">JPG, PNG, TIFF, HEIC, WebP</p>
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,.heic,.heif,.tif,.tiff"
                onChange={onFileInput}
                className="hidden"
              />
              {files.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-1 pr-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-2 py-1.5">
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-white/30">{(f.size / 1024).toFixed(0)}KB</span>
                      <button onClick={() => removeFile(i)} className="text-white/40 hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            <Button
              onClick={runParse}
              disabled={parsing || files.length === 0}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {parsing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo EXIF... {progress}%</>
              ) : (
                <><Play className="h-4 w-4" /> Extrair EXIF</>
              )}
            </Button>
          </div>

          {report && (
            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-white/80">Resumo</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Arquivos" value={report.totalFiles} />
                <Stat label="Com GPS" value={report.withGps} accent="text-emerald-400" />
                <Stat label="Com timestamp" value={report.withTimestamp} />
                <Stat label="Anomalias" value={report.anomaliesCount} accent={report.anomaliesCount ? "text-red-400" : ""} />
              </div>
              <Button onClick={runAi} disabled={analyzing} className="w-full gap-2">
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : "Gerar parecer com IA"}
              </Button>
              {analysis && !analyzing && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1 gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar evidência
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {records.length > 0 ? (
            <>
              <GeoMap records={records} />

              {anomaliesList.length > 0 && (
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <h3 className="font-display text-sm font-bold text-white/80">Anomalias detectadas</h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {anomaliesList.map((r) => (
                      <div key={r.hash} className="text-xs border-l-2 border-red-500/50 pl-3 py-1">
                        <div className="font-medium">{r.fileName}</div>
                        <div className="text-red-300/80">{r.anomalies.join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-card rounded-xl p-5">
                <h3 className="font-display text-sm font-bold text-white/80 mb-3">Inventário EXIF</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-white/40 uppercase text-[10px] tracking-wider border-b border-white/5">
                      <tr>
                        <th className="text-left py-2 pr-2">Arquivo</th>
                        <th className="text-left py-2 pr-2">Data</th>
                        <th className="text-left py-2 pr-2">GPS</th>
                        <th className="text-left py-2 pr-2">Dispositivo</th>
                        <th className="text-left py-2 pr-2">Software</th>
                        <th className="text-left py-2">Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.hash} className="border-b border-white/[0.03]">
                          <td className="py-2 pr-2 max-w-[180px] truncate">{r.fileName}</td>
                          <td className="py-2 pr-2 text-white/60">
                            {r.takenAt ? new Date(r.takenAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                          </td>
                          <td className="py-2 pr-2 text-white/60">
                            {r.lat != null ? `${r.lat.toFixed(4)}, ${r.lng!.toFixed(4)}` : "—"}
                          </td>
                          <td className="py-2 pr-2 text-white/60">
                            {[r.make, r.model].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="py-2 pr-2 text-white/60 max-w-[140px] truncate">{r.software || "—"}</td>
                          <td className="py-2 text-white/30 font-mono text-[10px]">{r.hash.slice(0, 12)}…</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-xl p-10 text-center text-white/40 text-sm">
              Envie imagens e clique em "Extrair EXIF" para visualizar mapa, timeline e inventário forense.
            </div>
          )}

          {(analyzing || analysis) && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-display text-sm font-bold text-white/80 mb-3">Parecer forense</h3>
              <div className="text-sm whitespace-pre-wrap text-white/90 leading-relaxed max-h-[600px] overflow-y-auto">
                {analysis || <span className="text-white/40 italic">Processando parecer...</span>}
                {analyzing && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-lg font-bold ${accent || "text-white"}`}>{value}</div>
    </div>
  );
}