import {
  FileSearch, FileText, HardDrive, Fingerprint,
  Code2, Mail, Globe, FileDown
} from "lucide-react";

const features = [
  {
    icon: HardDrive,
    title: "Leitura de Hives",
    desc: "Análise forense de registros do Windows (SAM, SYSTEM, SOFTWARE, NTUSER) com extração automática de artefatos e timeline.",
    badge: null,
  },
  {
    icon: Fingerprint,
    title: "Análise Grafotécnica",
    desc: "Comparação de padrões de escrita, análise de assinaturas e verificação de autenticidade com IA especializada.",
    badge: null,
  },
  {
    icon: FileText,
    title: "Elaboração de Laudos",
    desc: "Gere laudos técnicos estruturados com base nas evidências e documentos do processo, prontos para o tribunal.",
    badge: null,
  },
  {
    icon: FileSearch,
    title: "Análise Documental",
    desc: "Extraia dados, valores, datas e informações relevantes de documentos extensos automaticamente.",
    badge: null,
  },
  {
    icon: Code2,
    title: "Plágio de Código-Fonte",
    desc: "Comparação estrutural e semântica entre códigos-fonte para detecção de cópias e plágio.",
    badge: null,
  },
  {
    icon: Mail,
    title: "Análise de E-mails / PST",
    desc: "Análise forense de e-mails, cabeçalhos, metadados e detecção de manipulação.",
    badge: null,
  },
  {
    icon: Globe,
    title: "Captura de Provas Web",
    desc: "Registre e preserve conteúdos da internet (sites, redes sociais, WhatsApp Web) como provas digitais com validade jurídica.",
    badge: "Novo",
  },
  {
    icon: FileDown,
    title: "Exportação para Word",
    desc: "Exporte laudos e documentos em formato .docx profissional pronto para uso imediato.",
    badge: null,
  },
];

const FeaturesSection = () => {
  return (
    <section id="funcionalidades" className="py-24 border-t border-border/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Principais <span className="glow-text">Funcionalidades</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Ferramentas poderosas desenvolvidas especificamente para o trabalho pericial e forense.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass-card rounded-xl p-6 group transition-all hover:border-primary/30 hover:shadow-[0_0_30px_hsl(30_90%_50%/0.08)] relative"
            >
              {f.badge && (
                <span className="absolute top-4 right-4 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {f.badge}
                </span>
              )}
              <f.icon className="h-8 w-8 text-primary mb-4 transition-transform group-hover:scale-110" />
              <h3 className="font-display text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
