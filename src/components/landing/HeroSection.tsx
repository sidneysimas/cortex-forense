 import { ArrowRight, Fingerprint, Shield, Zap } from "lucide-react";
 import cortexBrain from "@/assets/cortex-brain.png";
 import { Button } from "@/components/ui/button";
 import { motion } from "framer-motion";

 const HeroSection = () => {
   return (
     <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black pt-20">
       {/* Noise Texture */}
       <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
       
       {/* Animated Background Gradients */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <motion.div 
           animate={{ 
             scale: [1, 1.2, 1],
             opacity: [0.3, 0.5, 0.3],
             x: [0, 50, 0],
             y: [0, -30, 0]
           }}
           transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
           className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] rounded-full bg-primary/10 blur-[150px]" 
         />
         <motion.div 
           animate={{ 
             scale: [1, 1.3, 1],
             opacity: [0.2, 0.4, 0.2],
             x: [0, -40, 0],
             y: [0, 60, 0]
           }}
           transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 2 }}
           className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] rounded-full bg-blue-500/5 blur-[150px]" 
         />
       </div>
 
       <div className="container relative z-10 mx-auto px-6 py-20">
         <div className="flex flex-col items-center text-center">
           {/* Badge */}
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 backdrop-blur-md shadow-premium-sm"
           >
             <div className="flex -space-x-2">
               <Fingerprint className="h-4 w-4 text-primary" />
               <Shield className="h-4 w-4 text-primary opacity-50" />
             </div>
             <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
               Advanced Digital Forensics AI
             </span>
           </motion.div>
 
           {/* Heading */}
           <motion.div
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
           >
              <h1 className="text-balance font-display text-5xl font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-6xl md:text-7xl lg:text-8xl max-w-6xl">
                Transformando Dados em <br />
                <span className="relative inline-block mt-2">
                  Evidências{" "}
                  <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                    Inquestionáveis
                  </span>
                 <motion.span 
                   initial={{ width: 0 }}
                   animate={{ width: "100%" }}
                   transition={{ duration: 1.5, delay: 1, ease: [0.16, 1, 0.3, 1] }}
                   className="absolute -bottom-2 left-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" 
                 />
               </span>
             </h1>
           </motion.div>
 
           <motion.p 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
             className="mx-auto mt-10 max-w-2xl text-lg font-light leading-relaxed text-white/50 md:text-xl lg:text-2xl"
           >
             A plataforma definitiva para perícia forense digital. Unimos inteligência artificial e rigor técnico para entregar laudos de precisão cirúrgica.
           </motion.p>
 
           {/* CTAs */}
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
             className="mt-14 flex flex-col items-center gap-6 sm:flex-row sm:justify-center"
           >
             <Button size="lg" className="h-14 bg-primary text-black font-bold hover:bg-white hover:text-black transition-all duration-500 gap-3 px-10 text-base shadow-glow-md rounded-xl group">
               Iniciar Investigação 
               <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
             </Button>
             <Button variant="ghost" size="lg" className="h-14 text-white font-medium hover:bg-white/5 gap-3 px-10 text-base rounded-xl transition-all">
               Explorar Módulos <Zap className="h-4 w-4 text-primary" />
             </Button>
           </motion.div>
 
           {/* Brain Visual (Cinematic) */}
           <motion.div
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="relative mt-20 w-full max-w-lg aspect-square flex items-center justify-center"
           >
             <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
             <img 
               src={cortexBrain} 
               alt="Cortex Intelligence" 
               className="relative z-10 w-64 h-64 md:w-80 md:h-80 object-contain drop-shadow-[0_0_50px_rgba(212,175,55,0.3)] animate-float" 
             />
             
             {/* Orbital elements */}
             <div className="absolute inset-0 border border-white/5 rounded-full animate-[spin_20s_linear_infinite]" />
             <div className="absolute inset-10 border border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
           </motion.div>
         </div>
       </div>
       
       {/* Bottom Fade */}
       <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black to-transparent z-20" />
     </section>
   );
 };

export default HeroSection;
