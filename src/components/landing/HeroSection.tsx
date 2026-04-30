import { ArrowRight, Fingerprint } from "lucide-react";
import cortexBrain from "@/assets/cortex-brain.png";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "95%", label: "Precisão na análise" },
  { value: "2000+", label: "Laudos gerados" },
  { value: "100%", label: "Rastreabilidade" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center hero-gradient overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="container relative mx-auto px-4 py-24 text-center">
        {/* Brain visual */}
        <img src={cortexBrain} alt="Cortex" className="mx-auto mb-8 h-28 w-28 animate-float drop-shadow-[0_0_30px_hsl(30_90%_50%/0.4)]" />

        {/* Badge */}
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
          <Fingerprint className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary">Inteligência Artificial Forense de Última Geração</span>
        </div>

        {/* Heading */}
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto">
          Da evidência ao laudo{" "}
          <span className="glow-text">com excelência</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Plataforma completa de perícia forense com IA: grafotecnia, leitura de hives,
          análise documental e geração de laudos técnicos com precisão incomparável.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8 text-base">
            Começar Agora <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary gap-2 px-8 text-base">
            Ver Funcionalidades
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 max-w-2xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="animate-count-up">
              <div className="font-display text-4xl font-bold text-primary stat-glow">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
