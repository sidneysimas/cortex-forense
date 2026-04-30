import { Mail, User, Calendar, Paperclip, Copy, Check, Loader2, Download, ShieldCheck } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { EmailDetail } from "@/lib/pst-utils";
import { getPstFile, getAttachmentData } from "@/lib/pst-utils";
import { saveEvidence, logAudit } from "@/lib/audit";

export type { EmailDetail };

interface EmailPreviewProps {
  email: EmailDetail | null;
  loading: boolean;
  folderNid: number | null;
  emailNid: number | null;
  pstFileName?: string;
  caseId?: string;
}

const EmailPreview = ({ email, loading, folderNid, emailNid, pstFileName, caseId }: EmailPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [savingEvidence, setSavingEvidence] = useState(false);

  const handleCopy = () => {
    const text = email?.bodyText || email?.subject || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAttachment = useCallback((attachmentIndex: number, fileName: string) => {
    if (!folderNid || !emailNid) return;
    const pst = getPstFile();
    if (!pst) return;

    setDownloadingIdx(attachmentIndex);
    setTimeout(() => {
      try {
        const result = getAttachmentData(pst, folderNid, emailNid, attachmentIndex);
        if (!result) {
          toast({ title: "Erro", description: "Não foi possível extrair o anexo.", variant: "destructive" });
          setDownloadingIdx(null);
          return;
        }

        const blob = new Blob([result.data], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.name || fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Download concluído", description: result.name });
      } catch (err) {
        console.error("Attachment download error:", err);
        toast({ title: "Erro ao baixar anexo", variant: "destructive" });
      } finally {
        setDownloadingIdx(null);
      }
    }, 0);
  }, [folderNid, emailNid]);

  const handleSaveEvidence = useCallback(async () => {
    if (!email) return;
    setSavingEvidence(true);
    try {
      // Build canonical text for hashing
      const canonical = [
        `Subject: ${email.subject || ""}`,
        `From: ${email.senderName} <${email.senderEmail}>`,
        `To: ${email.toRecipients || ""}`,
        `Cc: ${email.ccRecipients || ""}`,
        `Date: ${email.receivedDate || ""}`,
        `Attachments: ${email.attachments.map(a => a.name).join(", ") || "none"}`,
        `---`,
        email.bodyText || email.bodyHtml || "",
      ].join("\n");

      // Compute SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(canonical);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      await saveEvidence({
        module: "email-pst",
        title: `E-mail: ${email.subject || "(Sem assunto)"}`,
        inputContent: JSON.stringify({
          subject: email.subject,
          from: `${email.senderName} <${email.senderEmail}>`,
          to: email.toRecipients,
          cc: email.ccRecipients,
          date: email.receivedDate,
          attachments: email.attachments.map(a => a.name),
          pstFile: pstFileName || "",
        }),
        resultContent: email.bodyText || email.bodyHtml || "",
        fileHash: hash,
        metadata: {
          sha256: hash,
          pstFile: pstFileName || "",
          folderNid,
          emailNid,
          hasAttachments: email.hasAttachments,
          attachmentCount: email.attachments.length,
          capturedAt: new Date().toISOString(),
        },
        caseId,
      });

      toast({
        title: "Evidência salva",
        description: `Hash SHA-256: ${hash.substring(0, 16)}...`,
      });
    } catch (err) {
      console.error("Error saving evidence:", err);
      toast({ title: "Erro ao salvar evidência", description: "Verifique se está autenticado.", variant: "destructive" });
    } finally {
      setSavingEvidence(false);
    }
  }, [email, folderNid, emailNid, pstFileName, caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Mail className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Selecione um e-mail para visualizar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-muted/10 space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground leading-tight">
            {email.subject || "(Sem assunto)"}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0 h-7 text-xs gap-1">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveEvidence}
            disabled={savingEvidence}
            className="shrink-0 h-7 text-xs gap-1"
          >
            {savingEvidence ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            {savingEvidence ? "Salvando..." : "Salvar Evidência"}
          </Button>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <span className="font-medium text-foreground">{email.senderName}</span>
            {email.senderEmail && (
              <span>&lt;{email.senderEmail}&gt;</span>
            )}
          </div>
          {email.toRecipients && (
            <div className="flex gap-1.5">
              <span className="font-medium">Para:</span>
              <span className="truncate">{email.toRecipients}</span>
            </div>
          )}
          {email.ccRecipients && (
            <div className="flex gap-1.5">
              <span className="font-medium">Cc:</span>
              <span className="truncate">{email.ccRecipients}</span>
            </div>
          )}
          {email.receivedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>{email.receivedDate}</span>
            </div>
          )}
        </div>

        {email.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {email.attachments.map((att) => (
              <button
                key={att.index}
                onClick={() => handleDownloadAttachment(att.index, att.name)}
                disabled={downloadingIdx === att.index}
                className="flex items-center gap-1 rounded bg-muted/40 border border-border/50 px-2 py-1 text-xs hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer group"
                title={`Baixar ${att.name}`}
              >
                {downloadingIdx === att.index ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                )}
                <span className="truncate max-w-[150px]">{att.name}</span>
                {att.size > 0 && (
                  <span className="text-muted-foreground">
                    ({(att.size / 1024).toFixed(0)}KB)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {email.bodyHtml ? (
          <iframe
            srcDoc={`
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    * { color: #e0e0e0 !important; background-color: transparent !important; border-color: #333 !important; }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; margin: 0; padding: 8px; line-height: 1.6; word-wrap: break-word; background-color: #1a1a2e !important; }
                    a { color: #f97316 !important; text-decoration: underline; }
                    img { max-width: 100%; height: auto; }
                    table { max-width: 100% !important; }
                    font[color], span[style], p[style], div[style], td[style] { color: #e0e0e0 !important; }
                  </style>
                </head>
                <body>${email.bodyHtml}</body>
              </html>
            `}
            className="w-full h-full border-0 min-h-[300px] bg-transparent"
            sandbox="allow-same-origin"
            title="Email content"
          />
        ) : email.bodyText ? (
          <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
            {email.bodyText}
          </pre>
        ) : (
          <p className="text-muted-foreground italic text-sm">Sem conteúdo</p>
        )}
      </div>
    </div>
  );
};

export default EmailPreview;
