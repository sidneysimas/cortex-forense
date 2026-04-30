import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Plus, Loader2, Pencil, Trash2, FileText, FileDown, Globe, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";

interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  court: string;
  status: string;
  created_at: string;
  evidence_count?: number;
}

const statusLabels: Record<string, string> = {
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

const statusColors: Record<string, string> = {
  em_andamento: "text-amber-400 bg-amber-400/10",
  concluido: "text-green-400 bg-green-400/10",
  arquivado: "text-muted-foreground bg-muted/30",
};

const CasesPage = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Case | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingZip, setExportingZip] = useState<string | null>(null);
  const [exportLang, setExportLang] = useState("pt");
  const [form, setForm] = useState({ case_number: "", title: "", description: "", court: "", status: "em_andamento" });

  const fetchCases = async () => {
    if (!user) return;
    const { data: casesData } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (casesData) {
      // Get evidence counts
      const { data: evidences } = await supabase
        .from("evidences")
        .select("case_id")
        .eq("user_id", user.id)
        .not("case_id", "is", null);

      const countMap: Record<string, number> = {};
      evidences?.forEach((e: any) => { countMap[e.case_id] = (countMap[e.case_id] || 0) + 1; });

      setCases(casesData.map((c: any) => ({ ...c, evidence_count: countMap[c.id] || 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCases(); }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({ case_number: "", title: "", description: "", court: "", status: "em_andamento" });
    setDialogOpen(true);
  };

  const openEdit = (c: Case) => {
    setEditing(c);
    setForm({ case_number: c.case_number, title: c.title, description: c.description || "", court: c.court || "", status: c.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.title.trim()) {
      toast({ title: "Preencha ao menos o título", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("cases").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Caso atualizado" });
      } else {
        const { error } = await supabase.from("cases").insert({ ...form, user_id: user.id });
        if (error) throw error;
        toast({ title: "Caso criado" });
      }
      setDialogOpen(false);
      fetchCases();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este caso? As evidências vinculadas serão desvinculadas.")) return;
    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Caso excluído" });
      fetchCases();
    }
  };

  const handleExportReport = async (caseId: string, lang: string) => {
    setExporting(caseId);
    try {
      const { data, error } = await supabase.functions.invoke("export-case-report", {
        body: { caseId, lang },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const blob = new Blob([data.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) win.addEventListener("load", () => setTimeout(() => win.print(), 500));
      toast({ title: "Relatório gerado", description: "Use Ctrl+P para salvar como PDF." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const handleExportZip = async (caseId: string) => {
    setExportingZip(caseId);
    try {
      const { data, error } = await supabase.functions.invoke("export-zip", {
        body: { caseId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const binary = atob(data.zipBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "ZIP exportado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setExportingZip(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Casos & Processos</h1>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Caso
        </Button>
      </div>
      <p className="text-muted-foreground mb-6">Organize suas evidências e análises por processo judicial.</p>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : cases.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhum caso cadastrado. Crie um caso para agrupar suas evidências.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((c) => (
            <div key={c.id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-semibold text-foreground truncate">{c.title}</h3>
                  {c.case_number && <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.case_number}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status] || statusColors.em_andamento}`}>
                  {statusLabels[c.status] || c.status}
                </span>
              </div>
              {c.court && <p className="text-xs text-muted-foreground">{c.court}</p>}
              {c.description && <p className="text-sm text-foreground/70 line-clamp-2">{c.description}</p>}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {c.evidence_count} evidência{c.evidence_count !== 1 ? "s" : ""}
                </div>
                <div className="flex gap-1">
                  <Link to={`/dashboard/evidencias?case=${c.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-primary" title="Ver evidências"><FileText className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleExportReport(c.id, "pt")} disabled={exporting === c.id} className="h-7 px-2 text-primary" title="Relatório PT">
                    {exporting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  </Button>
                   <Button variant="ghost" size="sm" onClick={() => handleExportReport(c.id, "en")} disabled={exporting === c.id} className="h-7 px-2 text-muted-foreground" title="Report EN">
                     <Globe className="h-3.5 w-3.5" />
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => handleExportZip(c.id)} disabled={exportingZip === c.id} className="h-7 px-2 text-primary" title="Exportar ZIP">
                     {exportingZip === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-7 px-2 text-primary"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="h-7 px-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Caso" : "Novo Caso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Título *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Perícia em contrato de locação" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Número do Processo</label>
              <Input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value })} placeholder="Ex: 0000001-00.2026.8.26.0100" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Vara / Tribunal</label>
              <Input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} placeholder="Ex: 1ª Vara Cível — Foro Central" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do caso..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar Caso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CasesPage;
