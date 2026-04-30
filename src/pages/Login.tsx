import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Shield, Lock, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simular login e redirecionar para o dashboard
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10"></div>
      
      <Card className="w-full max-w-md bg-card/50 border-white/5 backdrop-blur-xl">
        <CardHeader className="text-center pb-8 border-b border-white/5">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">
            Acesso ao <span className="text-primary">Sistema</span>
          </CardTitle>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">
            Área Restrita - Órgãos de Inteligência
          </p>
        </CardHeader>
        
        <CardContent className="pt-8 px-8 pb-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Identificação</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10 h-12 bg-white/5 border-white/10" placeholder="Nome de Operador" required />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Chave de Segurança</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10 h-12 bg-white/5 border-white/10" type="password" placeholder="••••••••" required />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-sm font-black uppercase tracking-widest bg-orange-500 hover:bg-orange-600 transition-all">
              Autenticar Sistema
            </Button>
            
            <div className="text-center">
              <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                Voltar para o portal
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
