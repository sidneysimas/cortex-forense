 import { useState, useRef } from "react";
 import { Upload, File, X, Loader2, HardDrive, FileText, Globe } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import { generateSHA256 } from "@/lib/audit";
 
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
 
   const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const selectedFile = e.target.files?.[0];
     if (!selectedFile) return;
 
     setUploading(true);
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) throw new Error("Usuário não autenticado");
 
       // 1. Generate Hash (ISO 27037)
       const fileContent = await selectedFile.text();
       const hash = await generateSHA256(fileContent);
 
       // 2. Upload to Storage
       const fileExt = selectedFile.name.split('.').pop();
       const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
       const filePath = `evidences/${fileName}`;
 
       const { error: uploadError } = await supabase.storage
         .from('forensic-files')
         .upload(filePath, selectedFile);
 
       if (uploadError) throw uploadError;
 
       setFile({ name: selectedFile.name, path: filePath, hash });
       onFileUploaded(filePath, hash, selectedFile.name);
       toast({ title: "Arquivo carregado", description: "O arquivo foi enviado e processado com hash SHA-256." });
     } catch (err: any) {
       console.error("Upload error:", err);
       toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
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
     if (moduleType === "hives") return <HardDrive className="h-10 w-10 mb-2 opacity-50" />;
     if (moduleType === "documental") return <FileText className="h-10 w-10 mb-2 opacity-50" />;
     if (moduleType === "web-capture") return <Globe className="h-10 w-10 mb-2 opacity-50" />;
     return <Upload className="h-10 w-10 mb-2 opacity-50" />;
   };
 
   return (
     <div className="w-full">
       {!file ? (
         <div 
           onClick={() => fileInputRef.current?.click()}
           className="relative cursor-pointer group rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.04] hover:border-primary/30 flex flex-col items-center justify-center text-center"
         >
           <input 
             ref={fileInputRef}
             type="file" 
             className="hidden" 
             accept={acceptedTypes}
             onChange={handleUpload}
           />
           
           {uploading ? (
             <div className="flex flex-col items-center py-4">
               <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
               <p className="text-sm font-medium text-white/60">Enviando e calculando integridade...</p>
             </div>
           ) : (
             <>
               {getIcon()}
               <p className="text-sm font-medium text-white/80 group-hover:text-primary transition-colors">{label}</p>
               <p className="text-[11px] text-white/40 mt-2 uppercase tracking-widest">
                 ISO 27037 compliant hashing
               </p>
             </>
           )}
         </div>
       ) : (
         <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
           <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
             <File className="h-6 w-6" />
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-sm font-bold text-white truncate">{file.name}</p>
             <p className="text-[10px] font-mono text-white/40 truncate">SHA-256: {file.hash.slice(0, 32)}...</p>
           </div>
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={removeFile}
             className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10"
           >
             <X className="h-4 w-4" />
           </Button>
         </div>
       )}
     </div>
   );
 };
 
 export default FileUploader;