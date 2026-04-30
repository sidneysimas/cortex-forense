import { useState, useCallback, useMemo } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PstUploader from "@/components/pst-viewer/PstUploader";
import FolderTree from "@/components/pst-viewer/FolderTree";
import EmailList from "@/components/pst-viewer/EmailList";
import EmailPreview from "@/components/pst-viewer/EmailPreview";
import EmailSearchFilters, { type EmailFilters, emptyFilters } from "@/components/pst-viewer/EmailSearchFilters";
import type { PstFolderNode, EmailEntry, EmailDetail } from "@/lib/pst-utils";
import {
  openPstFile,
  getPstFile,
  buildFolderTree,
  getEmailsForFolder,
  getEmailDetail,
} from "@/lib/pst-utils";

const EmailPstPage = () => {
  const [fileLoaded, setFileLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  // Tree
  const [folders, setFolders] = useState<PstFolderNode[]>([]);
  const [selectedFolderNid, setSelectedFolderNid] = useState<number | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState("");
  const [expandedNids, setExpandedNids] = useState<Set<number>>(new Set());

  // Emails
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [filters, setFilters] = useState<EmailFilters>({ ...emptyFilters });
  // Preview
  const [selectedEmailNid, setSelectedEmailNid] = useState<number | null>(null);
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setLoading(true);
    setFileName(name);

    try {
      const pst = openPstFile(buffer);
      const tree = buildFolderTree(pst);
      setFolders(tree);
      setFileLoaded(true);

      // Find inbox or first folder with content, and expand path to it
      const inboxResult = findInbox(tree);
      const target = inboxResult || findFirstWithContent(tree);
      if (target) {
        // Build set of nids to expand (path from root to target)
        const pathNids = new Set<number>();
        findPathToFolder(tree, target.nid, pathNids);
        setExpandedNids(pathNids);
        handleSelectFolder(target.nid, target.displayName);
      }

      toast({ title: "Arquivo aberto com sucesso", description: `${name} carregado.` });
    } catch (err) {
      console.error("PST parse error:", err);
      toast({
        title: "Erro ao abrir arquivo",
        description: "O arquivo pode estar corrompido ou em formato não suportado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const INBOX_NAMES = ["inbox", "caixa de entrada", "boîte de réception", "posteingang", "bandeja de entrada", "itens enviados", "sent items", "itens-enviados", "deleted items", "itens excluídos"];

  const findInbox = (nodes: PstFolderNode[]): PstFolderNode | null => {
    for (const node of nodes) {
      if (INBOX_NAMES.includes(node.displayName.toLowerCase())) return node;
      if (node.children) {
        const found = findInbox(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const findFirstWithContent = (nodes: PstFolderNode[]): PstFolderNode | null => {
    for (const node of nodes) {
      if (node.contentCount > 0) return node;
      if (node.children) {
        const found = findFirstWithContent(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const findPathToFolder = (nodes: PstFolderNode[], targetNid: number, path: Set<number>): boolean => {
    for (const node of nodes) {
      if (node.nid === targetNid) {
        path.add(node.nid);
        return true;
      }
      if (node.children && findPathToFolder(node.children, targetNid, path)) {
        path.add(node.nid);
        return true;
      }
    }
    return false;
  };

  const handleSelectFolder = useCallback((nid: number, name?: string) => {
    setSelectedFolderNid(nid);
    setSelectedEmailNid(null);
    setEmailDetail(null);
    setFilters({ ...emptyFilters });

    const pst = getPstFile();
    if (!pst) return;

    const folderEmails = getEmailsForFolder(pst, nid, 0, 500);
    setEmails(folderEmails);

    if (name) setSelectedFolderName(name);
    else {
      // Find name from tree
      const findName = (nodes: PstFolderNode[]): string => {
        for (const n of nodes) {
          if (n.nid === nid) return n.displayName;
          if (n.children) {
            const found = findName(n.children);
            if (found) return found;
          }
        }
        return "";
      };
      setSelectedFolderName(findName(folders));
    }
  }, [folders]);

  const handleSelectEmail = useCallback((nid: number) => {
    setSelectedEmailNid(nid);
    setLoadingEmail(true);

    const pst = getPstFile();
    if (!pst || !selectedFolderNid) {
      setLoadingEmail(false);
      return;
    }

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const detail = getEmailDetail(pst, selectedFolderNid, nid);
        if (!detail) {
          toast({ title: "Erro ao abrir e-mail", description: "Não foi possível ler o conteúdo deste e-mail.", variant: "destructive" });
        }
        setEmailDetail(detail);
      } catch (err) {
        console.error("Error opening email:", err);
        toast({ title: "Erro ao abrir e-mail", description: "Este e-mail pode estar corrompido.", variant: "destructive" });
        setEmailDetail(null);
      }
      setLoadingEmail(false);
    }, 0);
  }, [selectedFolderNid]);

  // Filtered emails based on advanced filters
  const filteredEmails = useMemo(() => {
    let result = emails;
    const kw = filters.keyword.toLowerCase().trim();
    if (kw) {
      result = result.filter(
        (e) =>
          e.subject.toLowerCase().includes(kw) ||
          e.senderName.toLowerCase().includes(kw) ||
          e.senderEmail.toLowerCase().includes(kw)
      );
    }
    if (filters.sender.trim()) {
      const s = filters.sender.toLowerCase().trim();
      result = result.filter(
        (e) => e.senderName.toLowerCase().includes(s) || e.senderEmail.toLowerCase().includes(s)
      );
    }
    if (filters.dateFrom) {
      const from = filters.dateFrom.getTime();
      result = result.filter((e) => {
        const d = parsePtBrDate(e.receivedDate);
        return d ? d.getTime() >= from : true;
      });
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      const toMs = to.getTime();
      result = result.filter((e) => {
        const d = parsePtBrDate(e.receivedDate);
        return d ? d.getTime() <= toMs : true;
      });
    }
    if (filters.hasAttachment !== null) {
      result = result.filter((e) => e.hasAttachment === filters.hasAttachment);
    }
    return result;
  }, [emails, filters]);

  /** Parse pt-BR date string "dd/mm/yyyy hh:mm:ss" */
  function parsePtBrDate(str: string): Date | null {
    if (!str) return null;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1]);
  }

  if (!fileLoaded) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold mb-1">Análise de E-mails / PST</h1>
        <p className="text-muted-foreground mb-6">
          Abra arquivos PST do Outlook e navegue pelos e-mails como no Outlook.
        </p>
        <PstUploader onFileLoaded={handleFileLoaded} loading={loading} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-3">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg font-bold truncate">{fileName}</h1>
        <button
          onClick={() => {
            setFileLoaded(false);
            setFolders([]);
            setEmails([]);
            setEmailDetail(null);
          }}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Abrir outro arquivo
        </button>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 gap-0 border border-border/50 rounded-xl overflow-hidden bg-card/30">
        {/* Folders panel */}
        <div className="w-[220px] shrink-0 border-r border-border/50 overflow-auto bg-muted/5">
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pastas</p>
          </div>
          <FolderTree
            folders={folders}
            selectedNid={selectedFolderNid}
            onSelectFolder={(nid) => handleSelectFolder(nid)}
            expandedNids={expandedNids}
          />
        </div>

        {/* Email list panel */}
        <div className="w-[320px] shrink-0 border-r border-border/50 flex flex-col overflow-hidden">
          <EmailSearchFilters
            filters={filters}
            onChange={setFilters}
            resultCount={filteredEmails.length}
            totalCount={emails.length}
          />
          <div className="flex-1 overflow-hidden">
            <EmailList
              emails={filteredEmails}
              selectedNid={selectedEmailNid}
              onSelectEmail={handleSelectEmail}
              folderName={selectedFolderName}
              totalCount={emails.length}
            />
          </div>
        </div>

        {/* Email preview panel */}
        <div className="flex-1 overflow-hidden">
          <EmailPreview email={emailDetail} loading={loadingEmail} folderNid={selectedFolderNid} emailNid={selectedEmailNid} pstFileName={fileName} />
        </div>
      </div>
    </div>
  );
};

export default EmailPstPage;
