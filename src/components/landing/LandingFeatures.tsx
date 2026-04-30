import { Shield, Search, FileText, Share2, Zap, Lock } from "lucide-react";

const features = [
  {
    title: "Grafotecnia com IA",
    description: "Análise avançada de assinaturas e escritas com algoritmos de deep learning.",
    icon: <FileText className="w-6 h-6 text-orange-500" />
  },
  {
    title: "Leitura de Hives",
    description: "Processamento ultra-rápido de bases de dados complexas para cruzamento de informações.",
    icon: <Zap className="w-6 h-6 text-orange-500" />
  },
  {
    title: "Busca Inteligente",
    description: "Motor de busca OSINT integrado para localização de pessoas e bens em segundos.",
    icon: <Search className="w-6 h-6 text-orange-500" />
  },
  {
    title: "Segurança de Dados",
    description: "Criptografia de ponta a ponta e conformidade total com a LGPD.",
    icon: <Lock className="w-6 h-6 text-orange-500" />
  },
  {
    title: "Grafos de Vínculos",
    description: "Visualização intuitiva de relações entre entidades para investigações complexas.",
    icon: <Share2 className="w-6 h-6 text-orange-500" />
  },
  {
    title: "Laudos Automatizados",
    description: "Geração de documentos técnicos periciais em conformidade com as normas vigentes.",
    icon: <Shield className="w-6 h-6 text-orange-500" />
  }
];

export const LandingFeatures = () => {
  return (
    <section id="features" className="py-24 bg-white/5">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
            Funcionalidades <span className="text-orange-500">Premium</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ferramentas desenvolvidas especificamente para as necessidades de peritos e órgãos de inteligência.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="p-8 rounded-xl bg-card border border-white/5 hover:border-orange-500/30 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
