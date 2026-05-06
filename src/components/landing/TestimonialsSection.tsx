 import { Star, Quote } from "lucide-react";
 import { motion } from "framer-motion";

 const testimonials = [
   {
     text: "A integração da IA na grafotecnia não é apenas uma melhoria, é um salto geracional. O Cortex transformou minha produtividade e confiança técnica.",
     name: "Dr. Ricardo Mantovani",
     role: "Perito Grafotécnico Senior",
     avatar: "RM"
   },
   {
     text: "Processar gigabytes de Hives e artefatos de registro em minutos, com timeline consolidada, era um sonho. O Cortex tornou isso realidade.",
     name: "Dra. Carla Silveira",
     role: "Especialista em Forense Computacional",
     avatar: "CS"
   },
   {
     text: "A precisão dos laudos gerados e o rigor na cadeia de custódia digital são impecáveis. É o padrão ouro para qualquer perito judicial sério.",
     name: "Dr. Fernando Leite",
     role: "Perito Judicial Federal",
     avatar: "FL"
   },
 ];
 
 const TestimonialsSection = () => {
   return (
     <section id="depoimentos" className="relative bg-[#050505] py-32 overflow-hidden">
       {/* Glow effect */}
       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
 
       <div className="container relative z-10 mx-auto px-6">
         <div className="text-center mb-24">
           <motion.h2 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl mb-6"
           >
             Voices of <span className="text-primary">Authority.</span>
           </motion.h2>
           <motion.p 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.1 }}
             className="text-white/40 max-w-xl mx-auto text-lg font-light leading-relaxed"
           >
             O Cortex é a escolha dos principais peritos e investigadores do Brasil para casos de alta complexidade.
           </motion.p>
         </div>
 
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
           {testimonials.map((t, i) => (
             <motion.div 
               key={t.name}
               initial={{ opacity: 0, scale: 0.95 }}
               whileInView={{ opacity: 1, scale: 1 }}
               viewport={{ once: true }}
               transition={{ delay: 0.1 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
               className="group relative p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-500"
             >
               <div className="absolute top-10 right-10 text-primary/20 group-hover:text-primary/40 transition-colors">
                 <Quote className="h-10 w-10 rotate-180" />
               </div>
 
               <div className="flex gap-1 mb-8">
                 {Array.from({ length: 5 }).map((_, i) => (
                   <Star key={i} className="h-4 w-4 fill-primary text-primary shadow-glow-sm" />
                 ))}
               </div>
 
               <p className="text-white/70 text-lg font-light leading-relaxed mb-10 italic">
                 "{t.text}"
               </p>
 
               <div className="flex items-center gap-4 border-t border-white/5 pt-8">
                 <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-black font-bold text-sm shadow-premium-sm">
                   {t.avatar}
                 </div>
                 <div>
                   <p className="font-display font-bold text-white text-base tracking-tight">{t.name}</p>
                   <p className="text-xs text-white/40 font-medium uppercase tracking-widest mt-0.5">{t.role}</p>
                 </div>
               </div>
             </motion.div>
           ))}
         </div>
       </div>
     </section>
   );
 };

export default TestimonialsSection;
