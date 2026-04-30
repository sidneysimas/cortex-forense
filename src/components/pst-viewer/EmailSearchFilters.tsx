import { useState } from "react";
import { Search, Filter, X, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface EmailFilters {
  keyword: string;
  sender: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachment: boolean | null;
}

const emptyFilters: EmailFilters = {
  keyword: "",
  sender: "",
  dateFrom: undefined,
  dateTo: undefined,
  hasAttachment: null,
};

interface Props {
  filters: EmailFilters;
  onChange: (filters: EmailFilters) => void;
  resultCount: number;
  totalCount: number;
}

const EmailSearchFilters = ({ filters, onChange, resultCount, totalCount }: Props) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeCount = [
    filters.sender,
    filters.dateFrom,
    filters.dateTo,
    filters.hasAttachment !== null,
  ].filter(Boolean).length;

  const clearAll = () => onChange({ ...emptyFilters });

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border/50">
      {/* Main search */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar assunto, corpo..."
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
            className="h-7 text-xs pl-7 bg-muted/20 border-border/40"
          />
        </div>
        <Button
          variant={showAdvanced ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Filter className="h-3.5 w-3.5" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {/* Active filter badges */}
      {activeCount > 0 && !showAdvanced && (
        <div className="flex flex-wrap gap-1">
          {filters.sender && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              De: {filters.sender}
              <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => onChange({ ...filters, sender: "" })} />
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              Após: {format(filters.dateFrom, "dd/MM/yy")}
              <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => onChange({ ...filters, dateFrom: undefined })} />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              Até: {format(filters.dateTo, "dd/MM/yy")}
              <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => onChange({ ...filters, dateTo: undefined })} />
            </Badge>
          )}
          {filters.hasAttachment !== null && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              {filters.hasAttachment ? "Com anexo" : "Sem anexo"}
              <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => onChange({ ...filters, hasAttachment: null })} />
            </Badge>
          )}
          <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-foreground ml-1">
            Limpar
          </button>
        </div>
      )}

      {/* Advanced panel */}
      {showAdvanced && (
        <div className="flex flex-col gap-2 p-2 rounded-md bg-muted/20 border border-border/30">
          {/* Sender */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 block">Remetente</label>
            <Input
              placeholder="Nome ou e-mail..."
              value={filters.sender}
              onChange={(e) => onChange({ ...filters, sender: e.target.value })}
              className="h-7 text-xs bg-background/50 border-border/40"
            />
          </div>

          {/* Date range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 block">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-7 text-xs justify-start", !filters.dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(d) => onChange({ ...filters, dateFrom: d })}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 block">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-7 text-xs justify-start", !filters.dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(d) => onChange({ ...filters, dateTo: d })}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Attachment filter */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 block">Anexos</label>
            <div className="flex gap-1">
              {([null, true, false] as const).map((val) => (
                <Button
                  key={String(val)}
                  variant={filters.hasAttachment === val ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onChange({ ...filters, hasAttachment: val })}
                >
                  {val === null ? "Todos" : val ? "Com anexo" : "Sem anexo"}
                </Button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground">
              {resultCount} de {totalCount} e-mails
            </span>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={clearAll}>
              Limpar filtros
            </Button>
          </div>
        </div>
      )}

      {/* Result count when not showing advanced */}
      {!showAdvanced && resultCount !== totalCount && (
        <p className="text-[10px] text-muted-foreground">
          {resultCount} de {totalCount} e-mails
        </p>
      )}
    </div>
  );
};

export default EmailSearchFilters;
export { emptyFilters };
