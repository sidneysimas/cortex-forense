 import {
   FileSearch, FileText, HardDrive, Fingerprint,
   Code2, Mail, Globe, FileDown, Cpu, Zap, Database, Shield
 } from "lucide-react";
 import { motion } from "framer-motion";

 const FeaturesSection = () => {
   return (
     <section id="funcionalidades" className="relative bg-black py-32 overflow-hidden border-t border-white/5">
       <div className="container relative z-10 mx-auto px-6">
         <div className="mb-20">
           <motion.div
             initial={{ opacity: 0, x: -20 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold uppercase tracking-[0.2em] mb-8"
           >
             <Cpu className="w-3.5 h-3.5" />
             Cortex Ecosystem
           </motion.div>
           
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
             <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-7xl max-w-3xl leading-[1.05]"
             >
               Powerful tools for <br />
               <span className="text-white/40">digital forensic truth.</span>
             </motion.h2>
             <motion.p 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ delay: 0.2 }}
               className="max-w-md text-lg text-white/50 font-light leading-relaxed"
             >
               Uma suíte completa de módulos forenses projetados para transformar complexidade em evidência judicial irrefutável.
             </motion.p>
           </div>
         </div>
 
         <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5 auto-rows-[280px]">
           {/* Featured: Grafotecnia */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4 lg:row-span-2"
             icon={Fingerprint}
             title="Análise Grafotécnica"
             description="Deep learning aplicado à análise de grafismo. Identifique falsificações com precisão algorítmica e análise biomecânica da escrita."
             gradient="from-primary/20 to-transparent"
           />
           
           {/* Laudos */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4"
             icon={FileText}
             title="Laudos Profissionais"
             description="Geração automatizada em conformidade com padrões ABNT e ISO/IEC 27037."
           />
           
           {/* Doc Analysis */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4"
             icon={FileSearch}
             title="Análise Documental"
             description="Processamento de documentos extensos com OCR e extração estruturada de dados."
           />
 
           {/* Hives - Wide */}
           <BentoCard 
             className="md:col-span-6 lg:col-span-8"
             icon={HardDrive}
             title="Registry Artifacts (Hives)"
             description="Exploração profunda de registros do Windows para identificar persistência de malware e artefatos de execução suspeitos com timeline automatizada."
             horizontal
           />
 
           {/* Web Capture */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4"
             icon={Globe}
             title="Web Evidence Capture"
             description="Preservação de conteúdos web (redes sociais, sites) com certificação digital e validade jurídica."
             badge="Novo"
           />
           
           {/* Email/PST */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4"
             icon={Mail}
             title="PST & Email Analysis"
             description="Análise forense de caixas de email, cabeçalhos e metadados para investigações corporativas."
           />
 
           {/* Source Code */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4"
             icon={Code2}
             title="Source Code Plagiarism"
             description="Comparação estrutural e semântica entre códigos-fonte para detecção de cópias e plágio."
           />
 
           {/* Export */}
           <BentoCard 
             className="md:col-span-3 lg:col-span-4"
             icon={FileDown}
             title="Exportação Nativa"
             description="Exportação imediata para formatos editáveis mantendo formatação técnica profissional."
           />
 
           {/* Security - Large */}
           <BentoCard 
             className="md:col-span-6 lg:col-span-8 lg:row-span-1"
             icon={Shield}
             title="Cadeia de Custódia Imutável"
             description="Hashing avançado e timestamping para garantir integridade absoluta desde a coleta até o laudo final."
             horizontal
           />
         </div>
       </div>
     </section>
   );
 };
 
 const BentoCard = ({ 
   icon: Icon, 
   title, 
   description, 
   className = "", 
   gradient = "", 
   horizontal = false,
   badge = ""
 }: { 
   icon: any, 
   title: string, 
   description: string, 
   className?: string, 
   gradient?: string,
   horizontal?: boolean,
   badge?: string
 }) => (
   <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     viewport={{ once: true }}
     transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
     className={`group relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-8 transition-all duration-500 hover:bg-white/[0.04] hover:border-white/20 hover:shadow-premium-lg ${className}`}
   >
     {gradient && (
       <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none`} />
     )}
     
     <div className={`relative z-10 h-full flex ${horizontal ? 'flex-row items-center gap-10' : 'flex-col'}`}>
       <div className={horizontal ? '' : 'mb-auto'}>
         <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-primary transition-all duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:text-black shadow-premium-sm group-hover:shadow-glow-sm">
           <Icon className="h-7 w-7" />
         </div>
       </div>
       
       <div className={horizontal ? 'flex-1' : ''}>
         {badge && (
           <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
             {badge}
           </span>
         )}
         <h3 className="font-display text-xl font-bold text-white mb-3 tracking-tight group-hover:text-primary transition-colors duration-300">
           {title}
         </h3>
         <p className="text-sm font-light leading-relaxed text-white/40 group-hover:text-white/70 transition-colors duration-300">
           {description}
         </p>
       </div>
     </div>
     
     {/* Radial highlight on hover */}
     <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(212,175,55,0.08)_0%,transparent_70%)]" />
   </motion.div>
 );

export default FeaturesSection;
