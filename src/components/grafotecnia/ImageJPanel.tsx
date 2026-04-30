import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const IMAGEJ_URL = "https://ij.aicell.io/";

const ImageJPanel = () => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 border-border text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" />
        Abrir ImageJ.JS (análise avançada)
      </Button>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-foreground">ImageJ.JS</span>
          <span className="text-[10px] text-muted-foreground">— Análise avançada de imagens</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={IMAGEJ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <iframe
        src={IMAGEJ_URL}
        className="w-full border-0"
        style={{ height: 500 }}
        title="ImageJ.JS"
        allow="cross-origin-isolated"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
      />
    </div>
  );
};

export default ImageJPanel;
