 import { useState, useEffect } from "react";
 import { Menu, X, Shield } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Link } from "react-router-dom";
 import { motion, AnimatePresence } from "framer-motion";
 import cortexBrain from "@/assets/cortex-brain.png";

 const Navbar = () => {
   const [open, setOpen] = useState(false);
   const [scrolled, setScrolled] = useState(false);
 
   useEffect(() => {
     const handleScroll = () => setScrolled(window.scrollY > 20);
     window.addEventListener("scroll", handleScroll);
     return () => window.removeEventListener("scroll", handleScroll);
   }, []);
 
   const links = [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Benefícios", href: "#beneficios" },
    { label: "Depoimentos", href: "#depoimentos" },
    { label: "Planos", href: "#planos" },
  ];

   return (
     <motion.nav 
       initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
         scrolled 
           ? "h-16 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl" 
           : "h-20 bg-transparent"
       }`}
     >
       <div className="container mx-auto flex h-full items-center justify-between px-6">
         <a href="#" className="group flex items-center gap-3">
           <div className="relative">
             <img src={cortexBrain} alt="Cortex" className="h-9 w-9 transition-transform duration-500 group-hover:scale-110" />
             <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
           </div>
           <span className="font-display text-xl font-bold tracking-tight text-white">
             Cortex <span className="text-primary">Forense</span>
           </span>
         </a>

         <div className="hidden items-center gap-10 md:flex">
           {links.map((l, i) => (
             <motion.a 
               key={l.href} 
               href={l.href} 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.1 * i, duration: 0.5 }}
               className="relative text-[13px] font-medium uppercase tracking-widest text-white/60 transition-colors hover:text-primary group"
             >
               {l.label}
               <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
             </motion.a>
           ))}
         </div>

         <div className="hidden items-center gap-4 md:flex">
           <Button 
             variant="ghost" 
             size="sm" 
             className="text-white/80 hover:text-white hover:bg-white/5 transition-all" 
             asChild
           >
             <Link to="/login">Entrar</Link>
           </Button>
           <Button 
             size="sm" 
             className="bg-primary text-black font-semibold hover:bg-white hover:text-black transition-all duration-300 shadow-glow-sm hover:shadow-glow-md px-6"
           >
             Começar Agora
           </Button>
         </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

       <AnimatePresence>
         {open && (
           <motion.div 
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: "auto" }}
             exit={{ opacity: 0, height: 0 }}
             className="absolute top-full left-0 right-0 border-b border-white/10 bg-black/95 backdrop-blur-2xl md:hidden overflow-hidden"
           >
             <div className="container mx-auto flex flex-col gap-6 px-6 py-8">
               {links.map((l) => (
                 <a 
                   key={l.href} 
                   href={l.href} 
                   className="text-lg font-medium text-white/70 hover:text-primary transition-colors" 
                   onClick={() => setOpen(false)}
                 >
                   {l.label}
                 </a>
               ))}
               <hr className="border-white/10" />
               <div className="flex flex-col gap-4">
                 <Button variant="outline" className="border-white/10 text-white w-full" asChild>
                   <Link to="/login">Entrar</Link>
                 </Button>
                 <Button className="bg-primary text-black w-full">
                   Começar Agora
                 </Button>
               </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
     </motion.nav>
   );
 };

export default Navbar;
