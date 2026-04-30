import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Operacional",
    price: "R$ 497",
    period: "/mês",
    features: [
      "Busca Básica OSINT",
      "Leitura de Hives",
      "Até 50 consultas/mês",
      "Suporte via e-mail",
      "Laudos básicos"
    ],
    buttonText: "Assinar Mensal",
    highlight: false
  },
  {
    name: "Inteligência",
    price: "R$ 4.997",
    period: "/ano",
    features: [
      "Todas as funcionalidades",
      "Grafotecnia com IA",
      "Consultas ilimitadas",
      "Suporte 24/7 prioritário",
      "Grafos de vínculos",
      "Laudos periciais completos"
    ],
    buttonText: "Assinar Anual",
    highlight: true
  }
];

export const LandingPricing = () => {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
            Planos e <span className="text-orange-500">Investimento</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o nível de acesso ideal para suas necessidades periciais.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <div 
              key={i} 
              className={`p-10 rounded-2xl border ${
                plan.highlight 
                ? 'border-orange-500 bg-orange-500/5 shadow-[0_0_30px_rgba(249,115,22,0.1)]' 
                : 'border-white/5 bg-card'
              } flex flex-col`}
            >
              <h3 className="text-2xl font-black uppercase italic tracking-tight mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-muted-foreground text-sm font-bold uppercase">{plan.period}</span>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-orange-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <Button className={`w-full h-12 font-bold uppercase tracking-widest ${
                plan.highlight 
                ? 'bg-orange-500 hover:bg-orange-600' 
                : 'bg-white/5 hover:bg-white/10'
              }`}>
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
