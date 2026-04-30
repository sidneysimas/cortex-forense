import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import loginBg from "@/assets/login-bg.jpg";
import cortexBrain from "@/assets/cortex-brain.png";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (isForgot) {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
        setIsForgot(false);
      }
      return;
    }

    setLoading(true);
    if (isSignUp) {
      if (!fullName.trim()) {
        toast({ title: "Informe seu nome completo", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      setLoading(false);
      if (error) {
        toast({ title: "Erro no cadastro", description: error, variant: "destructive" });
      } else {
        toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro." });
        setIsSignUp(false);
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        toast({ title: "Erro no login", description: error, variant: "destructive" });
      } else {
        navigate("/dashboard");
      }
    }
  };

  return (
    <div className="relative flex min-h-screen">
      <div className="absolute inset-0 z-0">
        <img src={loginBg} alt="" className="h-full w-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-background/60" />
      </div>

      <div className="relative z-10 ml-auto flex w-full max-w-md flex-col justify-center px-8 py-12 sm:px-12 glass-card min-h-screen rounded-none border-r-0 border-t-0 border-b-0 border-l border-border/30">
        <div className="mb-10 flex flex-col items-center gap-3">
          <img src={cortexBrain} alt="Cortex Forense" className="h-20 w-20 drop-shadow-[0_0_20px_hsl(30_90%_50%/0.4)]" />
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Cortex <span className="glow-text">Forense</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isForgot ? "Recuperação de Senha" : isSignUp ? "Criar Conta de Perito" : "Plataforma de Perícia Forense com IA"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="name">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="name" placeholder="Dr. João da Silva" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-muted/50 border-border/60 text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="email">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-muted/50 border-border/60 text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>

          {!isForgot && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="password">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 bg-muted/50 border-border/60 text-foreground placeholder:text-muted-foreground" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {!isSignUp && !isForgot && (
            <div className="flex items-center justify-end text-sm">
              <button type="button" onClick={() => setIsForgot(true)} className="text-primary hover:underline">Esqueceu a senha?</button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isForgot ? "Enviar link de recuperação" : isSignUp ? "Criar Conta" : "Entrar"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isForgot ? (
            <button onClick={() => setIsForgot(false)} className="text-primary hover:underline font-medium">Voltar ao login</button>
          ) : isSignUp ? (
            <>Já tem conta?{" "}<button onClick={() => setIsSignUp(false)} className="text-primary hover:underline font-medium">Entrar</button></>
          ) : (
            <>Não tem conta?{" "}<button onClick={() => setIsSignUp(true)} className="text-primary hover:underline font-medium">Criar conta</button></>
          )}
        </div>

        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} Cortex Forense. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
