import { Button } from "@/components/ui/button";
import { Shield, Search, Share2, Eye, Lock, Zap, ChevronRight, Activity, Globe, Database } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 bg-cyber-grid bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-20" />
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 border border-primary rounded flex items-center justify-center shadow-[0_0_10px_rgba(0,255,255,0.4)] animate-pulse-neon">
              <Share2 className="text-primary w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">
              Trust <span className="text-primary">Grapher</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Metodologia", "Tecnologias", "Segurança", "Contato"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium hover:text-primary transition-colors">
                {item}
              </a>
            ))}
            <Button variant="neon">Acessar Plataforma</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-bold tracking-widest uppercase mb-8 animate-float">
            <Shield className="w-3 h-3" />
            Inteligência Forense de Próxima Geração
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic mb-6 leading-none">
            Conecte o <br />
            <span className="text-transparent bg-clip-text bg-neon-gradient">Invisível.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg mb-12">
            Plataforma OSINT e análise forense avançada para órgãos de segurança e inteligência. 
            Mapeie conexões, rastreie ativos e identifique padrões com precisão cirúrgica.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button size="lg" variant="neon" className="w-full sm:w-auto px-10 h-14 text-lg">
              Solicitar Demonstração
            </Button>
            <Button size="lg" variant="ghost" className="w-full sm:w-auto gap-2 group">
              Explorar Recursos <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mt-20 relative max-w-5xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-primary rounded-2xl blur-2xl opacity-20" />
          <div className="relative bg-card border border-white/10 rounded-2xl overflow-hidden aspect-video shadow-2xl">
            <div className="absolute top-0 w-full h-8 bg-muted/50 border-b border-white/5 flex items-center px-4 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <div className="w-full h-full p-8 flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80')] bg-cover bg-center grayscale opacity-40">
               <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
               <Activity className="w-20 h-20 text-primary animate-pulse opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="tecnologias" className="py-24 px-6 bg-white/[0.02]">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: <Search className="w-8 h-8" />,
                title: "OSINT Avançado",
                desc: "Extração automatizada de dados em fontes abertas, Deep Web e redes sociais com total anonimato."
              },
              {
                icon: <Globe className="w-8 h-8" />,
                title: "Geolocalização",
                desc: "Mapeamento temporal de movimentos e cruzamento de coordenadas geográficas em tempo real."
              },
              {
                icon: <Database className="w-8 h-8" />,
                title: "Grafos Relacionais",
                desc: "Visualize teias de relacionamentos complexas entre CPFs, CNPJs, endereços e ativos digitais."
              }
            ].map((f, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-card border border-white/5 hover:border-primary/50 transition-all duration-500">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 italic uppercase tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 border-y border-white/5 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Fontes de Dados", val: "500+" },
              { label: "Precisão Analítica", val: "99.9%" },
              { label: "Uptime do Sistema", val: "24/7" },
              { label: "Órgãos Parceiros", val: "120+" }
            ].map((s, i) => (
              <div key={i}>
                <div className="text-4xl md:text-5xl font-black text-primary mb-2">{s.val}</div>
                <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-black uppercase italic italic mb-8">
            Pronto para elevar sua <br />
            <span className="text-primary">Capacidade Operacional?</span>
          </h2>
          <p className="text-muted-foreground mb-12 text-lg">
            Acesso exclusivo para membros de forças de segurança pública e inteligência militar/civil. 
            Sua jornada para a verdade começa aqui.
          </p>
          <Button size="lg" variant="cyber" className="h-16 px-12 text-xl">
            Iniciar Acesso Credenciado
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 px-6">
        <div className="container mx-auto flex flex-col md:row items-center justify-between gap-8">
          <div className="flex items-center gap-3 grayscale">
            <Share2 className="text-white w-5 h-5" />
            <span className="text-lg font-bold tracking-tighter uppercase italic opacity-50">
              Trust Grapher
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            © 2026 Trust Grapher Forensic Systems. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">End-to-End Encrypted</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
