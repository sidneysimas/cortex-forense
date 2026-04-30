import { Shield, Brain, Microscope } from "lucide-react";

const cards = [
  {
    icon: Microscope,
    title: "Plataforma Completa",
    desc: "Todas as ferramentas periciais em um só lugar: grafotecnia, análise de hives, documentoscopia, geração de laudos e exportação.",
  },
  {
    icon: Brain,
    title: "IA Forense Avançada",
    desc: "Modelos treinados para compreender evidências forenses, documentos jurídicos e padrões grafotécnicos com máxima precisão.",
  },
  {
    icon: Shield,
    title: "Segurança e Rastreabilidade",
    desc: "Sistema anti-alucinação com citações obrigatórias. Cada informação é rastreada até a evidência original.",
  },
];

const areas = [
  "Forense Computacional", "Grafotécnica", "Informática Forense",
];

const AboutSection = () => {
  return (
    <section className="relative py-24 border-t border-border/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            O que é o <span className="glow-text">Cortex Forense</span>?
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            Uma plataforma de excelência que utiliza inteligência artificial avançada para revolucionar
            o trabalho de peritos forenses e judiciais.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-16">
          {cards.map((c) => (
            <div key={c.title} className="glass-card rounded-xl p-6 transition-all hover:border-primary/30">
              <c.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-xl p-8">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4 text-center">Áreas Atendidas</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {areas.map((a) => (
              <span
                key={a}
                className="rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-secondary-foreground"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
