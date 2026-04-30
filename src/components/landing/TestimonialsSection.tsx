import { Star } from "lucide-react";

const testimonials = [
  {
    text: "Reduzi o tempo de análise grafotécnica de 3 dias para apenas 4 horas. A precisão da IA é impressionante!",
    name: "Dr. Ricardo M.",
    role: "Perito Grafotécnico",
  },
  {
    text: "A leitura de hives automatizada revolucionou minha prática em informática forense. Resultados consistentes sempre.",
    name: "Dra. Carla S.",
    role: "Perita em Informática Forense",
  },
  {
    text: "Finalmente uma ferramenta que entende as necessidades específicas da perícia forense brasileira.",
    name: "Dr. Fernando L.",
    role: "Perito Judicial",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="depoimentos" className="py-24 border-t border-border/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            O que dizem os <span className="glow-text">Peritos</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="glass-card rounded-xl p-6">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground/90 leading-relaxed italic">"{t.text}"</p>
              <div className="mt-6 border-t border-border/50 pt-4">
                <p className="font-display font-semibold text-foreground text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
