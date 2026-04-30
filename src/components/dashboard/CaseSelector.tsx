import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase } from "lucide-react";

interface CaseSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const CaseSelector = ({ value, onChange }: CaseSelectorProps) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<{ id: string; title: string; case_number: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("cases")
      .select("id, title, case_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCases(data as any[]);
      });
  }, [user]);

  if (cases.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-muted/30 border-border/60 h-9 text-sm">
          <SelectValue placeholder="Vincular a um caso (opcional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem caso</SelectItem>
          {cases.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.title}{c.case_number ? ` (${c.case_number})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CaseSelector;
