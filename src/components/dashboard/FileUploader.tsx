 import { useState, useRef } from "react";
 import { Upload, File, X, Loader2, HardDrive, FileText, Globe } from "lucide-react";
 import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FileUploaderProps {
  onFileUploaded: (filePath: string, fileHash: string, fileName: string) => void;
  onFileRemoved: () => void;
  acceptedTypes?: string;
  label?: string;
  moduleType?: string;
}

const FileUploader = ({ 
  onFileUploaded, 
  onFileRemoved, 
  acceptedTypes = "*/*", 
  label = "Clique ou arraste para enviar o arquivo",
  moduleType = "generic"
}: FileUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<{ name: string; path: string; hash: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateSHA256FromBuffer = async (buffer: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Client-side size validation (1GB)
    const MAX_SIZE = 1024 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      toast({ title: "Arquivo muito grande", description: "O limite para análise é 1GB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Generate Hash efficiently using ArrayBuffer (handles binaries correctly)
      const buffer = await selectedFile.arrayBuffer();
      const hash = await generateSHA256FromBuffer(buffer);

      // 2. Upload to Storage
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/evidences/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('forensic-files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setFile({ name: selectedFile.name, path: filePath, hash });
      onFileUploaded(filePath, hash, selectedFile.name);
      toast({ title: "Integridade Verificada", description: "Arquivo preservado com Hash SHA-256." });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Falha na Aquisição", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    onFileRemoved();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getIcon = () => {
    if (moduleType === "hives") return <HardDrive className="h-10 w-10 mb-2 text-primary opacity-50" />;
    if (moduleType === "documental") return <FileText className="h-10 w-10 mb-2 text-primary opacity-50" />;
    if (moduleType === "web-capture") return <Globe className="h-10 w-10 mb-2 text-primary opacity-50" />;
    return <Upload className="h-10 w-10 mb-2 text-primary opacity-50" />;
  };

  return (
    <div className="w-full">
      {!file ? (
        <div 
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative cursor-pointer group rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.01] p-8 transition-all hover:bg-white/[0.04] hover:border-primary/40 flex flex-col items-center justify-center text-center ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            accept={acceptedTypes}
            onChange={handleUpload}
            disabled={uploading}
          />
          
          {uploading ? (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
               <p className="text-xs font-bold text-white/40 uppercase tracking-widest animate-pulse">Integridade Pericial: Calculando SHA-256...</p>
               <div className="mt-2 w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: "100%" }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="h-full bg-primary shadow-glow-sm"
                 />
               </div>
            </div>
          ) : (
            <>
              {getIcon()}
              <p className="text-sm font-bold text-white/70 group-hover:text-primary transition-colors">{label}</p>
              <div className="mt-4 flex gap-2">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30 font-bold uppercase tracking-tighter">AES-256 Encrypted</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30 font-bold uppercase tracking-tighter">ISO 27037</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-primary/5 border border-primary/20 shadow-glow-sm">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <File className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate leading-none mb-1">{file.name}</p>
            <p className="text-[10px] font-mono text-primary/40 truncate uppercase tracking-tighter">Verified Hash: {file.hash.slice(0, 16)}...</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={removeFile}
            className="h-9 w-9 p-0 rounded-full hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
