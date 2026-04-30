import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

export const LandingHeader = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-black tracking-tighter uppercase italic text-xl text-primary">
          <Shield className="w-8 h-8" />
          Cortex <span className="text-white">Forense</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Funcionalidades</a>
          <a href="#benefits" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Benefícios</a>
          <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Depoimentos</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Planos</a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6">
            Começar Agora
          </Button>
        </div>
      </div>
    </nav>
  );
};
