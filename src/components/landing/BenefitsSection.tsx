 import { TrendingUp, Target, Award, Zap, BarChart3, Rocket, CheckCircle2 } from "lucide-react";
 import { motion } from "framer-motion";

 const BenefitsSection = () => {
   return (
     <section id="beneficios" className="relative bg-[#050505] py-32 overflow-hidden">
       {/* Background accent */}
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
       
       <div className="container relative z-10 mx-auto px-6">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
           <div>
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               className="mb-8"
             >
               <h2 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl leading-[1.1] mb-8">
                 The new standard for <br />
                 <span className="text-primary">forensic intelligence.</span>
               </h2>
               <p className="text-xl text-white/40 font-light leading-relaxed mb-10">
                 Não somos apenas uma ferramenta. Somos o parceiro estratégico que eleva sua prática pericial ao nível máximo de autoridade e eficiência.
               </p>
             </motion.div>
 
             <div className="space-y-6">
               {[
                 "Redução de 80% no tempo de elaboração de laudos.",
                 "Precisão algorítmica em análises grafotécnicas complexas.",
                 "Cadeia de custódia certificada e imutável.",
                 "Escalabilidade para múltiplos peritos e organizações."
               ].map((item, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, x: -20 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: 0.1 * i }}
                   className="flex items-center gap-4 group"
                 >
                   <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                     <CheckCircle2 className="h-4 w-4" />
                   </div>
                   <span className="text-white/70 font-medium group-hover:text-white transition-colors">{item}</span>
                 </motion.div>
               ))}
             </div>
           </div>
 
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <BenefitCard 
               icon={TrendingUp} 
               title="Economia" 
               desc="Maximize sua rentabilidade reduzindo drasticamente o overhead operacional."
               delay={0.1}
             />
             <BenefitCard 
               icon={Target} 
               title="Precisão" 
               desc="Resultados técnicos embasados em dados e ciência forense computacional."
               delay={0.2}
             />
             <BenefitCard 
               icon={Award} 
               title="Autoridade" 
               desc="Laudos impecáveis que transmitem confiança absoluta aos tribunais."
               delay={0.3}
             />
             <BenefitCard 
               icon={Rocket} 
               title="Escala" 
               desc="Processe volumes massivos de dados sem comprometer a qualidade."
               delay={0.4}
             />
           </div>
         </div>
       </div>
     </section>
   );
 };
 
 const BenefitCard = ({ icon: Icon, title, desc, delay }: { icon: any, title: string, desc: string, delay: number }) => (
   <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     viewport={{ once: true }}
     transition={{ delay, duration: 0.5 }}
     className="group p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20 transition-all"
   >
     <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-black transition-all">
       <Icon className="h-6 w-6" />
     </div>
     <h3 className="font-display text-xl font-bold text-white mb-3 tracking-tight group-hover:text-primary transition-colors">{title}</h3>
     <p className="text-sm font-light leading-relaxed text-white/40 group-hover:text-white/60 transition-colors">{desc}</p>
   </motion.div>
 );

export default BenefitsSection;
