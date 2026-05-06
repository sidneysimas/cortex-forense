 import { Scale, ArrowRight, Shield, Globe, Mail, Linkedin, Twitter, Instagram } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { motion } from "framer-motion";
import cortexBrain from "@/assets/cortex-brain.png";

 const FooterSection = () => {
   return (
     <>
       {/* Final CTA Section */}
       <section className="relative py-32 overflow-hidden bg-black border-t border-white/5">
         {/* Animated Background Gradients */}
         <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full opacity-50" />
         </div>
 
         <div className="container relative z-10 mx-auto px-6 text-center">
           <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             whileInView={{ opacity: 1, scale: 1 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="max-w-4xl mx-auto rounded-[3rem] border border-white/10 bg-white/[0.02] p-12 md:p-20 backdrop-blur-3xl shadow-premium-lg"
           >
             <h2 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl mb-8 leading-tight">
               Define the future of your <br />
               <span className="text-primary">forensic investigations.</span>
             </h2>
             <p className="text-xl text-white/50 font-light leading-relaxed max-w-2xl mx-auto mb-12">
               Junte-se à elite da perícia digital. Comece sua jornada com o Cortex Forense hoje e experimente o poder da inteligência forense de última geração.
             </p>
             <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
               <Button size="lg" className="h-16 rounded-2xl bg-primary text-black font-bold hover:bg-white hover:text-black transition-all duration-500 px-12 text-lg shadow-glow-md group">
                 Começar Agora <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
               </Button>
               <Button variant="ghost" size="lg" className="h-16 rounded-2xl text-white font-medium hover:bg-white/5 px-10 text-lg">
                 Falar com um Especialista
               </Button>
             </div>
           </motion.div>
         </div>
       </section>
 
       {/* Footer */}
       <footer className="bg-black border-t border-white/5 pt-20 pb-10">
         <div className="container mx-auto px-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
             <div className="col-span-1 md:col-span-1">
               <div className="flex items-center gap-3 mb-8">
                 <img src={cortexBrain} alt="Cortex" className="h-8 w-8" />
                 <span className="font-display text-xl font-bold text-white tracking-tight">Cortex <span className="text-primary">Forense</span></span>
               </div>
               <p className="text-sm text-white/40 leading-relaxed font-light mb-8">
                 The leading forensic intelligence platform for digital investigators and legal professionals in Brazil.
               </p>
               <div className="flex items-center gap-4">
                 {[Linkedin, Twitter, Instagram].map((Icon, i) => (
                   <a key={i} href="#" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-primary hover:text-black transition-all">
                     <Icon className="h-5 w-5" />
                   </a>
                 ))}
               </div>
             </div>
 
             <div>
               <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-[11px]">Plataforma</h4>
               <ul className="space-y-4">
                 {["Funcionalidades", "Grafotecnia", "Forense de Redes", "Web Capture"].map((item) => (
                   <li key={item}><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors font-light">{item}</a></li>
                 ))}
               </ul>
             </div>
 
             <div>
               <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-[11px]">Empresa</h4>
               <ul className="space-y-4">
                 {["Sobre Nós", "Carreiras", "Privacidade", "Termos de Uso"].map((item) => (
                   <li key={item}><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors font-light">{item}</a></li>
                 ))}
               </ul>
             </div>
 
             <div>
               <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-[11px]">Contato</h4>
               <ul className="space-y-4">
                 <li className="flex items-center gap-3 text-sm text-white/40 font-light">
                   <Mail className="h-4 w-4 text-primary" /> contato@cortexforense.com.br
                 </li>
                 <li className="flex items-center gap-3 text-sm text-white/40 font-light">
                   <Globe className="h-4 w-4 text-primary" /> São Paulo, Brasil
                 </li>
               </ul>
             </div>
           </div>
 
           <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
             <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.3em]">
               © {new Date().getFullYear()} Cortex Intelligence Systems. All Rights Reserved.
             </p>
             <div className="flex items-center gap-8 text-[11px] font-bold text-white/20 uppercase tracking-[0.3em]">
               <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
               <a href="#" className="hover:text-primary transition-colors">Security</a>
             </div>
           </div>
         </div>
       </footer>
     </>
   );
 };

export default FooterSection;
