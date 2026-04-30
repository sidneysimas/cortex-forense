import { TrendingUp, Target, Award, Zap, BarChart3, Rocket } from "lucide-react";

const benefits = [
  { icon: TrendingUp, title: "Economia", desc: "Reduza custos operacionais e aumente sua margem de lucro" },
  { icon: Target, title: "Precisão", desc: "Análises técnicas com citações e referências verificáveis" },
  { icon: Award, title: "Qualidade", desc: "Laudos profissionais no padrão exigido pelos tribunais" },
  { icon: Zap, title: "Agilidade", desc: "Horas viram minutos com análise automatizada" },
  { icon: BarChart3, title: "Produtividade", desc: "Mais casos, mais receita, menos esforço repetitivo" },
  { icon: Rocket, title: "Escalabilidade", desc: "Cresça sem limites operacionais" },
];

const BenefitsSection = () => {
  return (
    <section id="beneficios" className="py-24 border-t border-border/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Os Pilares da <span className="glow-text">Excelência Forense</span>
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {benefits.map((b) => (
            <div key={b.title} className="flex items-start gap-4 rounded-xl bg-secondary/30 border border-border/50 p-5 transition-all hover:border-primary/20">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
