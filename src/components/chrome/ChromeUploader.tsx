import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectKind, sha256Hex, type ArtifactKind } from "@/lib/chrome-parsers";

export interface UploadedArtifact {
  file: File;
  name: string;
  size: number;
  sha256: string;
  kind: ArtifactKind;
}

const KIND_LABEL: Record<ArtifactKind, string> = {
  history: "History",
  login_data: "Login Data",
  web_data: "Web Data",
  cookies: "Cookies",
  bookmarks: "Bookmarks",
  unknown: "Desconhecido",
};

const KIND_COLOR: Record<ArtifactKind, string> = {
  history: "text-emerald-400",
  login_data: "text-amber-400",
  web_data: "text-sky-400",
  cookies: "text-purple-400",
  bookmarks: "text-pink-400",
  unknown: "text-white/40",
};

export default function ChromeUploader({
  onChange,
}: {
  onChange: (files: UploadedArtifact[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadedArtifact[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFiles = async (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    setProcessing(true);
    const next: UploadedArtifact[] = [...items];
    for (const file of Array.from(fl)) {
      const buf = await file.arrayBuffer();
      const sha = await sha256Hex(buf);
      const kind = await detectKind(file);
      next.push({ file, name: file.name, size: file.size, sha256: sha, kind });
    }
    setItems(next);
    onChange(next);
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".sqlite,.db,.json,application/octet-stream"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-white/[0.02] rounded-2xl p-8 text-center cursor-pointer transition-all"
      >
        <Upload className="h-8 w-8 mx-auto text-white/40 mb-3" />
        <p className="text-sm font-medium text-white/80">
          Arraste arquivos do perfil Chrome/Edge/Brave ou clique para selecionar
        </p>
        <p className="text-xs text-white/40 mt-1">
          History, Login Data, Web Data, Cookies (SQLite) e Bookmarks (JSON)
        </p>
        <p className="text-[10px] text-emerald-400/70 mt-3 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3 w-3" /> Processamento 100% local — arquivos não saem do dispositivo
        </p>
      </div>

      {processing && (
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando hash e detectando tipo...
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <FileText className={`h-4 w-4 shrink-0 ${KIND_COLOR[it.kind]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{it.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-white/5 ${KIND_COLOR[it.kind]}`}>
                    {KIND_LABEL[it.kind]}
                  </span>
                </div>
                <div className="text-[10px] text-white/40 font-mono truncate">
                  {(it.size / 1024).toFixed(1)} KB · SHA-256: {it.sha256.slice(0, 24)}…
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-red-400" onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
