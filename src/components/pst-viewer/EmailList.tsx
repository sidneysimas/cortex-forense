import { Mail, Paperclip } from "lucide-react";
import type { EmailEntry } from "@/lib/pst-utils";

export type { EmailEntry };

interface EmailListProps {
  emails: EmailEntry[];
  selectedNid: number | null;
  onSelectEmail: (nid: number) => void;
  folderName: string;
  totalCount: number;
}

const EmailList = ({ emails, selectedNid, onSelectEmail, folderName, totalCount }: EmailListProps) => {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <Mail className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Pasta vazia</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground">
          {folderName} — {totalCount} mensagen{totalCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        {emails.map((email) => {
          const isSelected = selectedNid === email.nid;
          return (
            <button
              key={email.nid}
              onClick={() => onSelectEmail(email.nid)}
              className={`w-full text-left px-3 py-2.5 border-b border-border/30 transition-colors ${
                isSelected
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : "hover:bg-muted/30"
              } ${!email.read ? "font-medium" : ""}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm truncate text-foreground">
                      {email.senderName || email.senderEmail || "Desconhecido"}
                    </span>
                    {email.hasAttachment && (
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <p className="text-sm truncate text-foreground/80 mt-0.5">
                    {email.subject || "(Sem assunto)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {email.receivedDate}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EmailList;
