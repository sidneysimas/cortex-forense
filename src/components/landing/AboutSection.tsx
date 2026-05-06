 import { Shield, Brain, Microscope, Terminal, Layers, Search } from "lucide-react";
 import { motion } from "framer-motion";

 const AboutSection = () => {
   return (
     <section className="relative bg-[#020202] py-32 overflow-hidden border-t border-white/5">
       <div className="container relative z-10 mx-auto px-6">
         <div className="flex flex-col lg:flex-row items-center gap-20">
           <div className="lg:w-1/2">
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
             >
               <h2 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl mb-8 leading-tight">
                 Deep Forensic <br />
                 <span className="text-white/40">Intelligence Hub.</span>
               </h2>
               <p className="text-xl text-white/50 font-light leading-relaxed mb-10">
                 O Cortex Forense é o resultado da fusão entre as mais avançadas técnicas de investigação digital e algoritmos proprietários de inteligência artificial.
               </p>
               <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                   <h4 className="text-white font-bold tracking-tighter text-2xl">Anti-Hallucination</h4>
                   <p className="text-xs text-white/40 font-medium uppercase tracking-widest">Rigor Técnico Absoluto</p>
                 </div>
                 <div className="space-y-2">
                   <h4 className="text-white font-bold tracking-tighter text-2xl">Traceability</h4>
                   <p className="text-xs text-white/40 font-medium uppercase tracking-widest">Rastreabilidade Total</p>
                 </div>
               </div>
             </motion.div>
           </div>
 
           <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-6">
             <FeatureItem 
               icon={Terminal} 
               title="Plataforma Completa" 
               desc="Grafotecnia, análise de hives, documentoscopia e perícia digital em um ecossistema unificado."
             />
             <FeatureItem 
               icon={Layers} 
               title="Arquitetura de Dados" 
               desc="Processamento massivo de evidências com hashing automático e cadeia de custódia imutável."
             />
             <FeatureItem 
               icon={Search} 
               title="Análise Preditiva" 
               desc="Detecção de anomalias em escritas e documentos através de redes neurais profundas."
             />
             <FeatureItem 
               icon={Shield} 
               title="Validade Jurídica" 
               desc="Metodologias em total conformidade com as diretrizes do judiciário brasileiro."
             />
           </div>
         </div>
       </div>
     </section>
   );
 };
 
 const FeatureItem = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
   <motion.div
     initial={{ opacity: 0, scale: 0.95 }}
     whileInView={{ opacity: 1, scale: 1 }}
     viewport={{ once: true }}
     className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-500 group"
   >
     <Icon className="h-8 w-8 text-primary mb-6 transition-transform group-hover:scale-110" />
     <h3 className="text-white font-bold text-lg mb-3 tracking-tight group-hover:text-primary transition-colors">{title}</h3>
     <p className="text-sm text-white/40 leading-relaxed font-light">{desc}</p>
   </motion.div>
 );

export default AboutSection;
