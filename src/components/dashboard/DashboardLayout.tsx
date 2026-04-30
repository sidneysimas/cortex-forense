import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Fingerprint, HardDrive, FileSearch, FileText, Code2, Mail, Globe,
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Building2,
  UserCircle, Shield, Database, Camera, FileQuestion, Briefcase,
  Lock, Link2, BarChart3, History, Clock, ScanText, FileStack, Network, Monitor,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import cortexBrain from "@/assets/cortex-brain.png";

const navItems = [
  { icon: LayoutDashboard, label: "Painel", path: "/dashboard" },
  { icon: Fingerprint, label: "Grafotecnia", path: "/dashboard/grafotecnia" },
  { icon: HardDrive, label: "Leitura de Hives", path: "/dashboard/hives" },
  { icon: FileSearch, label: "Análise Documental", path: "/dashboard/documental" },
  { icon: FileText, label: "Geração de Laudos", path: "/dashboard/laudos" },
  { icon: Code2, label: "Plágio de Código", path: "/dashboard/plagio-codigo" },
  { icon: Mail, label: "Análise de E-mails", path: "/dashboard/email-pst" },
  { icon: Globe, label: "Captura Web", path: "/dashboard/web-capture" },
  { icon: Lock, label: "Sandbox (Antifraude)", path: "/dashboard/sandbox" },
  { icon: Camera, label: "Análise de Imagens", path: "/dashboard/analise-imagem" },
  { icon: ScanText, label: "OCR", path: "/dashboard/ocr" },
  { icon: Network, label: "Forense de Redes", path: "/dashboard/rede" },
  { icon: Monitor, label: "Event Log (EVTX)", path: "/dashboard/event-log" },
  { icon: FileQuestion, label: "Quesitos", path: "/dashboard/quesitos" },
];

const adminItems = [
  { icon: Briefcase, label: "Casos / Processos", path: "/dashboard/casos" },
  { icon: Database, label: "Cadeia de Custódia", path: "/dashboard/evidencias" },
  { icon: History, label: "Histórico de Versões", path: "/dashboard/versoes" },
  { icon: Clock, label: "Timeline do Caso", path: "/dashboard/timeline" },
  { icon: FileStack, label: "Templates de Laudo", path: "/dashboard/templates" },
  { icon: Link2, label: "Compartilhamento", path: "/dashboard/compartilhar" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Shield, label: "Auditoria", path: "/dashboard/auditoria" },
  { icon: Mail, label: "Config. E-mail", path: "/dashboard/email-config" },
  { icon: Building2, label: "Organização", path: "/dashboard/organizacao" },
  { icon: UserCircle, label: "Meu Perfil", path: "/dashboard/perfil" },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const renderLink = (item: typeof navItems[0]) => {
    const active = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
          active
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        } ${collapsed ? "justify-center" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`flex flex-col border-r border-border/50 bg-card transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <div className="flex h-16 items-center gap-2 border-b border-border/50 px-4">
          <img src={cortexBrain} alt="Cortex" className="h-8 w-8 shrink-0" />
          {!collapsed && <span className="font-display text-lg font-bold">Cortex <span className="glow-text">Forense</span></span>}
        </div>

        <OrgSwitcher collapsed={collapsed} />

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map(renderLink)}

          {!collapsed && <div className="pt-4 pb-1 px-3 text-xs text-muted-foreground/60 uppercase tracking-wider">Gestão</div>}
          {collapsed && <div className="border-t border-border/30 my-2" />}
          {adminItems.map(renderLink)}
        </nav>

        <div className="border-t border-border/50 p-2 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {!collapsed && <span>Recolher</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
