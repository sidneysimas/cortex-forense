import { ForensicDashboard } from "@/components/dashboard/ForensicDashboard";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { Shield, LayoutDashboard, Search, GitBranch, AlertCircle, Settings, UserCircle, LogOut } from "lucide-react";

export default function Index() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="bg-card/50 border-r border-white/5 w-64">
        <SidebarHeader className="h-20 border-b border-white/5 flex items-center px-6">
          <div className="flex items-center gap-2 font-black tracking-tighter uppercase italic text-lg text-primary">
            <Shield className="w-6 h-6" />
            TRUST
          </div>
        </SidebarHeader>
        <SidebarContent className="p-4 space-y-2">
          {[
            { name: "Painel", icon: LayoutDashboard },
            { name: "Busca Inteligente", icon: Search },
            { name: "Grafos Forenses", icon: GitBranch },
            { name: "Alertas", icon: AlertCircle },
          ].map((item, i) => (
            <button key={i} className="w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-primary transition-all">
              <item.icon className="w-4 h-4" />
              {item.name}
            </button>
          ))}
          <div className="pt-8">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-bold text-muted-foreground hover:text-red-500 transition-all">
               <LogOut className="w-4 h-4" />
               Sair do Sistema
            </button>
          </div>
        </SidebarContent>
      </Sidebar>
      
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-xl font-bold uppercase tracking-widest italic">Bem-vindo, Operador</h1>
          <div className="flex items-center gap-4">
             <div className="text-right">
                <div className="text-sm font-bold">Investigador X</div>
                <div className="text-[10px] text-primary uppercase font-bold tracking-widest">Nível de Acesso: Máximo</div>
             </div>
             <UserCircle className="w-10 h-10 text-muted-foreground" />
          </div>
        </header>
        <ForensicDashboard />
      </main>
    </div>
  );
}
