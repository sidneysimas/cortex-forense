 import { Check, Sparkles, ShieldCheck } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { motion } from "framer-motion";

 const PricingSection = () => {
   return (
     <section id="planos" className="relative bg-black py-32 overflow-hidden border-t border-white/5">
       <div className="container relative z-10 mx-auto px-6">
         <div className="text-center mb-24">
           <motion.h2 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl mb-6"
           >
             Investment in <span className="text-primary">Clarity.</span>
           </motion.h2>
           <motion.p 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.1 }}
             className="text-white/40 max-w-xl mx-auto text-lg font-light"
           >
             Estrutura de preços transparente e escalável para peritos independentes e grandes organizações forenses.
           </motion.p>
         </div>
 
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
           {/* Monthly Plan */}
           <PricingCard 
             name="Professional"
             subtitle="Ideal para peritos independentes"
             price="197"
             period="mensal"
             features={[
               "Acesso completo a todos os módulos",
               "Análise de evidências ilimitada",
               "Grafotecnia assistida por IA",
               "Extração de artefatos de Hives",
               "Exportação profissional (.docx)",
               "Cadeia de custódia certificada",
               "Suporte técnico prioritário"
             ]}
           />
 
           {/* Annual Plan */}
           <PricingCard 
             name="Enterprise"
             subtitle="Para máxima economia e eficiência"
             price="157"
             period="anual"
             popular
             discount="Economize 20%"
             features={[
               "Tudo do plano Professional",
               "Menor custo por investigação",
               "Gestão multi-organização",
               "API para integração customizada",
               "Templates de laudo exclusivos",
               "Treinamento de equipe incluído",
               "Gerente de conta dedicado"
             ]}
           />
         </div>
 
         <motion.div 
           initial={{ opacity: 0 }}
           whileInView={{ opacity: 1 }}
           viewport={{ once: true }}
           className="mt-20 text-center"
         >
           <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white/60 text-sm">
             <ShieldCheck className="h-4 w-4 text-primary" />
             Pagamento seguro processado com criptografia de ponta a ponta.
           </div>
         </motion.div>
       </div>
     </section>
   );
 };
 
 const PricingCard = ({ 
   name, 
   subtitle, 
   price, 
   period, 
   features, 
   popular = false, 
   discount = "" 
 }: { 
   name: string, 
   subtitle: string, 
   price: string, 
   period: string, 
   features: string[], 
   popular?: boolean, 
   discount?: string 
 }) => (
   <motion.div
     initial={{ opacity: 0, y: 30 }}
     whileInView={{ opacity: 1, y: 0 }}
     viewport={{ once: true }}
     className={`group relative flex flex-col rounded-[2.5rem] border p-10 transition-all duration-500 ${
       popular 
         ? "border-primary/40 bg-white/[0.04] shadow-glow-md" 
         : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
     }`}
   >
     {popular && (
       <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-primary text-black text-[10px] font-bold uppercase tracking-widest shadow-glow-sm">
         Most Efficient
       </div>
     )}
 
     <div className="mb-10">
       {discount && (
         <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mb-4">
           {discount}
         </span>
       )}
       <h3 className="font-display text-2xl font-bold text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{name}</h3>
       <p className="text-sm font-light text-white/40 leading-relaxed">{subtitle}</p>
     </div>
 
     <div className="mb-10">
       <div className="flex items-baseline gap-1">
         <span className="text-white/40 text-2xl font-light">R$</span>
         <span className="text-white text-6xl font-bold tracking-tighter">{price}</span>
         <span className="text-white/40 text-lg font-light ml-2">/ {period}</span>
       </div>
     </div>
 
     <ul className="flex-1 space-y-4 mb-10">
       {features.map((f, i) => (
         <li key={i} className="flex items-start gap-4 text-sm text-white/60 font-light group-hover:text-white/80 transition-colors">
           <Check className="h-5 w-5 text-primary shrink-0" />
           {f}
         </li>
       ))}
     </ul>
 
     <Button 
       size="lg" 
       className={`h-14 rounded-2xl font-bold transition-all duration-500 ${
         popular 
           ? "bg-primary text-black hover:bg-white hover:text-black shadow-glow-sm" 
           : "bg-white/10 text-white hover:bg-white/20"
       }`}
     >
       Selecionar {name} <Sparkles className="ml-2 h-4 w-4" />
     </Button>
   </motion.div>
 );

export default PricingSection;
