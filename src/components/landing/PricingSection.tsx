import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Plano Mensal",
    subtitle: "Flexibilidade total",
    price: "R$ 197",
    period: "/mês",
    popular: false,
    features: [
      "Acesso completo à plataforma",
      "Análise ilimitada de documentos",
      "Grafotecnia com IA",
      "Leitura de Hives",
      "Exportação para Word",
      "Suporte por email",
    ],
  },
  {
    name: "Plano Anual",
    subtitle: "Economia garantida",
    price: "R$ 157",
    period: "/mês",
    popular: true,
    discount: "Economize 20%",
    features: [
      "Tudo do plano mensal",
      "Economia de R$ 480/ano",
      "Prioridade no suporte",
      "Acesso antecipado a novidades",
      "Consultoria de implantação",
      "API de integração",
    ],
  },
];

const PricingSection = () => {
  return (
    <section id="planos" className="py-24 border-t border-border/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Planos e <span className="glow-text">Preços</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Escolha o plano ideal para suas necessidades.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-8 transition-all ${
                p.popular
                  ? "glow-border bg-card relative"
                  : "glass-card"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  MAIS POPULAR
                </span>
              )}
              {p.discount && (
                <span className="inline-block rounded-full bg-primary/10 border border-primary/30 px-3 py-0.5 text-xs font-medium text-primary mb-4">
                  {p.discount}
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-foreground">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.subtitle}</p>

              <div className="mt-6 mb-8">
                <span className="font-display text-4xl font-bold text-foreground">{p.price}</span>
                <span className="text-muted-foreground">{p.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground/80">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  p.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Assinar {p.name.split(" ")[1]}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
