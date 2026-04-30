import { FileUp } from "lucide-react";
import { useRef } from "react";
import { toast } from "@/hooks/use-toast";

interface PstUploaderProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  loading: boolean;
}

const PstUploader = ({ onFileLoaded, loading }: PstUploaderProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: "Limite de 200MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      if (buffer) onFileLoaded(buffer, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <input
        ref={fileRef}
        type="file"
        accept=".pst,.ost,.eml,.msg,.mbox"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 p-16 text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer"
      >
        <FileUp className="h-14 w-14 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {loading ? "Carregando..." : "Abrir arquivo PST"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            .pst, .ost — até 200MB
          </p>
        </div>
      </button>
    </div>
  );
};

export default PstUploader;
