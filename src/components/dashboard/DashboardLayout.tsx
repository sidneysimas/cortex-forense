 import { useState, useEffect } from "react";
 import { Link, useLocation, useNavigate } from "react-router-dom";
 import {
   Fingerprint, HardDrive, FileSearch, FileText, Code2, Mail, Globe,
   LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Building2,
   UserCircle, Shield, Database, Camera, FileQuestion, Briefcase,
   Lock, Link2, BarChart3, History, Clock, ScanText, FileStack, Network, Monitor,
  Search, Bell, Settings, Inbox, Sun, Moon
 } from "lucide-react";
 import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useOrganization } from "@/hooks/useOrganization";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import ResponsibilityTerm from "@/components/dashboard/ResponsibilityTerm";
import { logAudit } from "@/lib/audit";
import cortexBrain from "@/assets/cortex-brain.png";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const { signOut, user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [profileName, setProfileName] = useState<string>("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Load profile name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.full_name || user.email?.split("@")[0] || "Usuário");
      });
  }, [user]);

  // Load notifications
  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_queue")
      .select("id, subject, body, notification_type, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);
    const list = data || [];
    setNotifications(list);
    setUnreadCount(list.filter((n: any) => n.status === "pending").length);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/dashboard/evidencias?q=${encodeURIComponent(q)}`);
  };

  // Audit: register every page navigation under the dashboard
  useEffect(() => {
    const all = [...navItems, ...adminItems];
    const match = all.find((i) => i.path === location.pathname);
    const label = match?.label || location.pathname;
    logAudit("page_view", match ? label.toLowerCase().replace(/\s+/g, "_") : "navigation", {
      path: location.pathname,
      label,
    });
  }, [location.pathname]);

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
         className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-300 ${
           active
             ? "bg-primary text-black shadow-glow-sm"
             : "text-white/40 hover:bg-white/5 hover:text-white"
         } ${collapsed ? "justify-center" : ""}`}
         title={collapsed ? item.label : undefined}
       >
         <item.icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110 ${active ? "text-black" : ""}`} />
         {!collapsed && <span className="tracking-tight">{item.label}</span>}
         {active && !collapsed && (
           <motion.div 
             layoutId="nav-glow"
             className="absolute inset-0 rounded-xl bg-primary/20 blur-md -z-10"
           />
         )}
       </Link>
     );
   };
 
   return (
     <div className="flex min-h-screen bg-[#020202] text-white selection:bg-primary/30 overflow-hidden">
      <ResponsibilityTerm />
       {/* Background Depth Effects */}
       <div className="fixed inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px]" />
       </div>
 
       {/* Noise overlay for consistent premium feel */}
       <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50" />
 
       <motion.aside 
         animate={{ width: collapsed ? 80 : 280 }}
         transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
         className="relative flex flex-col border-r border-white/5 bg-[#050505]/80 backdrop-blur-xl overflow-hidden z-40"
       >
         <div className="flex h-20 items-center gap-3 px-6 border-b border-white/5">
           <img src={cortexBrain} alt="Cortex" className="h-8 w-8 shrink-0 transition-transform hover:scale-110 duration-500" />
           {!collapsed && (
             <motion.span 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="font-display text-lg font-bold tracking-tight"
             >
               Cortex <span className="text-primary">Forense</span>
             </motion.span>
           )}
         </div>
 
         <div className="px-4 py-4">
           <OrgSwitcher collapsed={collapsed} />
         </div>
 
         <nav className="flex-1 space-y-1 px-4 overflow-y-auto no-scrollbar">
           <div className="py-2">
             {navItems.map(renderLink)}
           </div>
 
           {!collapsed && (
             <div className="mt-8 mb-4 px-3 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
               Investigation Management
             </div>
           )}
           {collapsed && <div className="border-t border-white/5 my-4" />}
           
           <div className="py-2">
             {adminItems.map(renderLink)}
           </div>
         </nav>
 
         <div className="mt-auto border-t border-white/5 p-4 space-y-2">
           <button
             onClick={() => setCollapsed(!collapsed)}
             className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 hover:bg-white/5 hover:text-white transition-all group"
           >
             {collapsed ? <ChevronRight className="h-4.5 w-4.5 group-hover:translate-x-0.5 transition-transform" /> : <ChevronLeft className="h-4.5 w-4.5 group-hover:-translate-x-0.5 transition-transform" />}
             {!collapsed && <span className="tracking-tight">Recolher Menu</span>}
           </button>
           <button
             onClick={handleLogout}
             className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all group"
           >
             <LogOut className="h-4.5 w-4.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
             {!collapsed && <span className="tracking-tight">Encerrar Sessão</span>}
           </button>
         </div>
       </motion.aside>
 
       <main className="flex-1 flex flex-col h-screen overflow-hidden">
         {/* Top Header */}
          <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md shrink-0">
            <form onSubmit={handleSearch} className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-2 w-full max-w-md group focus-within:border-primary/50 transition-all">
              <Search className="h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar evidências, laudos ou processos..."
                className="bg-transparent border-none outline-none text-[13px] w-full text-white placeholder:text-white/20"
              />
            </form>

            <div className="flex items-center gap-3">
              <Popover onOpenChange={(o) => { if (o) loadNotifications(); }}>
                <PopoverTrigger asChild>
                  <button
                    title="Notificações"
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all relative"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-black rounded-full border-2 border-black">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 p-0 bg-[#0a0a0a] border-white/10 text-white">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <h3 className="font-display text-sm font-bold">Notificações</h3>
                    <span className="text-[10px] uppercase tracking-widest text-white/40">{notifications.length} recentes</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-white/40">
                        <Inbox className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-xs">Nenhuma notificação</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-start gap-2">
                            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.status === "pending" ? "bg-primary" : "bg-white/20"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate">{n.subject || "Notificação"}</p>
                              <p className="text-[11px] text-white/50 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-white/30 mt-1">
                                {new Date(n.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => navigate("/dashboard/auditoria")}
                    className="w-full px-4 py-2.5 text-[12px] font-medium text-primary hover:bg-white/5 border-t border-white/5 transition-colors"
                  >
                    Ver log de auditoria completo →
                  </button>
                </PopoverContent>
              </Popover>

              <button
                onClick={() => navigate("/dashboard/email-config")}
                title="Configurações"
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
                aria-label="Alternar tema"
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <div className="h-8 w-px bg-white/5 mx-2" />
              <button
                onClick={() => navigate("/dashboard/perfil")}
                className="flex items-center gap-3 pl-2 hover:opacity-80 transition-opacity"
                title="Meu perfil"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-[13px] font-bold tracking-tight">{profileName || "Carregando..."}</p>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">Perito</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/50 border border-white/10 shadow-glow-sm flex items-center justify-center text-black font-bold text-sm">
                  {(profileName || user?.email || "U").charAt(0).toUpperCase()}
                </div>
              </button>
            </div>
          </header>
 
         <div className="flex-1 overflow-y-auto no-scrollbar custom-scrollbar">
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
             className="p-8 md:p-12 max-w-[1600px] mx-auto w-full"
           >
             {children}
           </motion.div>
         </div>
       </main>
     </div>
   );
 };

export default DashboardLayout;
