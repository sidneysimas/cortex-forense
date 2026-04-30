import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

export const LandingFooter = () => {
  return (
    <footer className="py-12 border-t border-white/5 bg-background">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
          <div className="flex items-center gap-2 font-black tracking-tighter uppercase italic text-xl text-primary">
            <Shield className="w-8 h-8" />
            Cortex <span className="text-white">Forense</span>
          </div>
          
          <div className="flex items-center gap-8">
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-white">Termos de Uso</Link>
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-white">Privacidade</Link>
            <Link to="/contact" className="text-xs text-muted-foreground hover:text-white">Contato</Link>
          </div>
        </div>
        
        <div className="text-center md:text-left text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          © 2024 Cortex Binário. Todos os direitos reservados. Focado em órgãos de inteligência e segurança pública.
        </div>
      </div>
    </footer>
  );
};
