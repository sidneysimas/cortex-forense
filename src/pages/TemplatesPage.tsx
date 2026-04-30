import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileText, Plus, Pencil, Trash2, Copy } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const defaultTemplates = [
  {
    id: "grafotecnia-padrao",
    name: "Laudo de Grafotecnia",
    module: "grafotecnia",
    sections: "1. INTRODUÇÃO\n2. MATERIAL EXAMINADO\n3. METODOLOGIA\n4. EXAME PERICIAL\n4.1 Análise Morfológica\n4.2 Análise Genérica\n4.3 Análise Genética\n5. CONCLUSÃO\n6. ENCERRAMENTO",
  },
  {
    id: "documental-padrao",
    name: "Laudo Documental",
    module: "documental",
    sections: "1. PREÂMBULO\n2. HISTÓRICO\n3. OBJETO DA PERÍCIA\n4. QUESITOS\n5. EXAME E ANÁLISE\n6. RESPOSTAS AOS QUESITOS\n7. CONCLUSÃO",
  },
  {
    id: "computacional-padrao",
    name: "Laudo Computacional",
    module: "hives",
    sections: "1. INTRODUÇÃO\n2. EQUIPAMENTOS ANALISADOS\n3. CADEIA DE CUSTÓDIA\n4. METODOLOGIA\n5. ACHADOS\n5.1 Sistema de Arquivos\n5.2 Registros do Sistema\n5.3 Artefatos de Navegação\n6. ANÁLISE\n7. CONCLUSÃO",
  },
  {
    id: "plagio-padrao",
    name: "Laudo de Plágio",
    module: "plagio-codigo",
    sections: "1. INTRODUÇÃO\n2. MATERIAL RECEBIDO\n3. METODOLOGIA DE COMPARAÇÃO\n4. ANÁLISE DE SIMILARIDADE\n5. TRECHOS IDENTIFICADOS\n6. CONCLUSÃO\n7. ANEXOS",
  },
];

const moduleLabels: Record<string, string> = {
  grafotecnia: "Grafotecnia",
  hives: "Computacional",
  documental: "Documental",
  laudo: "Geral",
  "plagio-codigo": "Plágio",
  "email-pst": "E-mails",
  "web-capture": "Captura Web",
  "analise-imagem": "Imagens",
  quesitos: "Quesitos",
  ocr: "OCR",
};

interface Template {
  id: string;
  name: string;
  module: string;
  sections: string;
  isDefault?: boolean;
}

const TemplatesPage = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>(
    defaultTemplates.map((t) => ({ ...t, isDefault: true }))
  );
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", module: "grafotecnia", sections: "" });

  const allTemplates = [...templates, ...customTemplates];

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", module: "grafotecnia", sections: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({ name: t.name, module: t.module, sections: t.sections });
    setDialogOpen(true);
  };

  const handleDuplicate = (t: Template) => {
    const newT: Template = {
      id: crypto.randomUUID(),
      name: `${t.name} (cópia)`,
      module: t.module,
      sections: t.sections,
    };
    setCustomTemplates([...customTemplates, newT]);
    toast({ title: "Template duplicado" });
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.sections.trim()) {
      toast({ title: "Preencha nome e seções", variant: "destructive" });
      return;
    }
    if (editing && !editing.isDefault) {
      setCustomTemplates(customTemplates.map((t) =>
        t.id === editing.id ? { ...t, ...form } : t
      ));
      toast({ title: "Template atualizado" });
    } else {
      const newT: Template = { id: crypto.randomUUID(), ...form };
      setCustomTemplates([...customTemplates, newT]);
      toast({ title: "Template criado" });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setCustomTemplates(customTemplates.filter((t) => t.id !== id));
    toast({ title: "Template removido" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Templates de Laudo</h1>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>
      <p className="text-muted-foreground mb-6">Modelos personalizáveis por tipo de perícia.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allTemplates.map((t) => (
          <div key={t.id} className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-sm font-semibold text-foreground truncate">{t.name}</h3>
                <span className="text-xs text-primary">{moduleLabels[t.module] || t.module}</span>
              </div>
              {t.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Padrão</span>
              )}
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6 bg-muted/20 rounded p-2">
              {t.sections}
            </pre>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleDuplicate(t)} className="h-7 px-2 text-primary" title="Duplicar">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="h-7 px-2 text-primary" title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!t.isDefault && (
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="h-7 px-2 text-destructive" title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Nome do Template *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Laudo de Grafotecnia Avançado" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Módulo</label>
              <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(moduleLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Estrutura de Seções *</label>
              <Textarea
                value={form.sections}
                onChange={(e) => setForm({ ...form, sections: e.target.value })}
                placeholder="1. INTRODUÇÃO&#10;2. MATERIAL EXAMINADO&#10;3. METODOLOGIA&#10;..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Criar Template"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesPage;
