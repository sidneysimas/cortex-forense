import { Scale, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import cortexBrain from "@/assets/cortex-brain.png";

const FooterSection = () => {
  return (
    <>
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
        </div>
        <div className="container relative mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl max-w-xl mx-auto">
            Pronto para transformar seu <span className="glow-text">trabalho forense</span>?
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Junte-se aos peritos que já estão economizando tempo e entregando laudos de excelência.
          </p>
          <Button size="lg" className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8">
            Começar Agora <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={cortexBrain} alt="Cortex" className="h-6 w-6" />
            <span className="font-display text-sm font-semibold text-foreground">Cortex Forense</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Cortex Forense. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </>
  );
};

export default FooterSection;
