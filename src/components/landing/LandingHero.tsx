import { Button } from "@/components/ui/button";
import { ChevronRight, Zap } from "lucide-react";

export const LandingHero = () => {
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10"></div>
      
      <div className="container mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
          <Zap className="w-4 h-4 fill-current" />
          Inteligência Artificial Forense de Última Geração
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-8 leading-[0.9]">
          Da evidência ao laudo <span className="text-orange-500">com excelência</span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-muted-foreground text-lg mb-10">
          Plataforma completa de perícia forense com IA: grafotecnia, leitura de hives, 
          análise documental e geração de laudos técnicos com precisão incomparável.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 px-8 flex items-center gap-2">
            Começar Agora <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="h-12 px-8 border-white/10 hover:bg-white/5">
            Ver Funcionalidades
          </Button>
        </div>
        
        <div className="mt-20 relative">
           <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
           <img 
             src="https://forense.cortexbinario.com.br/hero-image.png" 
             alt="Cortex Forense Platform" 
             className="rounded-xl border border-white/10 shadow-2xl mx-auto max-w-5xl w-full"
             onError={(e) => {
               (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1200";
             }}
           />
        </div>
      </div>
    </section>
  );
};
