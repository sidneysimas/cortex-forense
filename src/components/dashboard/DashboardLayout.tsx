 import { useState, useEffect } from "react";
 import { Link, useLocation, useNavigate } from "react-router-dom";
 import {
   Fingerprint, HardDrive, FileSearch, FileText, Code2, Mail, Globe,
   LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Building2,
   UserCircle, Shield, Database, Camera, FileQuestion, Briefcase,
   Lock, Link2, BarChart3, History, Clock, ScanText, FileStack, Network, Monitor,
   Search, Bell, Settings
 } from "lucide-react";
 import { motion, AnimatePresence } from "framer-motion";
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
           <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-2 w-full max-w-md group focus-within:border-primary/50 transition-all">
             <Search className="h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors" />
             <input 
               type="text" 
               placeholder="Buscar evidências, laudos ou processos..." 
               className="bg-transparent border-none outline-none text-[13px] w-full text-white placeholder:text-white/20"
             />
           </div>
 
           <div className="flex items-center gap-3">
             <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all relative">
               <Bell className="h-5 w-5" />
               <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-black" />
             </button>
             <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">
               <Settings className="h-5 w-5" />
             </button>
             <div className="h-8 w-px bg-white/5 mx-2" />
             <div className="flex items-center gap-3 pl-2">
               <div className="text-right hidden sm:block">
                 <p className="text-[13px] font-bold tracking-tight">Sidney Silva</p>
                 <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">Administrator</p>
               </div>
               <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/50 border border-white/10 shadow-glow-sm" />
             </div>
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
