import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_PREFIX = "cortex_term_accepted_v1::";

const ResponsibilityTerm = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    const accepted = localStorage.getItem(storageKey);
    if (!accepted) setOpen(true);
  }, [storageKey]);

  const handleAccept = () => {
    if (!checked || !storageKey) return;
    localStorage.setItem(storageKey, new Date().toISOString());
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0b0b]/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            <div className="flex items-start gap-4 p-7 border-b border-white/5 bg-white/[0.02]">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-white">
                  Termo de Uso e Responsabilidade
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Leitura obrigatória antes de utilizar a plataforma
                </p>
              </div>
            </div>

            <div className="p-7 space-y-4 text-[14px] leading-relaxed text-white/75 max-h-[55vh] overflow-y-auto custom-scrollbar">
              <p>
                A plataforma <strong className="text-white">Cortex Forense</strong> constitui ferramenta tecnológica de apoio à atividade pericial,
                não substituindo, em nenhuma hipótese, o profissional perito ou assistente técnico.
              </p>
              <p>
                Todas as análises, resultados e relatórios gerados pela plataforma são de natureza auxiliar e devem ser{" "}
                <strong className="text-white">obrigatoriamente validados</strong> pelo profissional responsável antes de qualquer utilização
                em procedimentos judiciais ou extrajudiciais.
              </p>
              <p>
                O princípio do <strong className="text-white">"Human-in-the-Loop"</strong> é condição essencial: a decisão final, a interpretação
                técnica e a responsabilidade pelo conteúdo pericial cabem exclusivamente ao profissional habilitado, conforme disposto no{" "}
                <strong className="text-white">Art. 159 do Código de Processo Penal</strong> e nas normas do respectivo conselho de classe.
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <p className="font-semibold text-white">Ao prosseguir, declaro estar ciente de que:</p>
                <ul className="space-y-1.5 text-white/70 list-disc pl-5 marker:text-primary">
                  <li>A plataforma é um instrumento de apoio, não um substituto do perito;</li>
                  <li>A validação técnica de todo conteúdo gerado é de minha inteira responsabilidade;</li>
                  <li>O uso indevido ou sem revisão humana pode acarretar consequências legais e éticas;</li>
                  <li>Os dados processados devem respeitar a LGPD e o sigilo profissional aplicável.</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/5 p-5 bg-black/30 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="h-5 w-5 rounded-full border-2 border-white/30 flex items-center justify-center transition-all peer-checked:border-primary peer-checked:bg-primary">
                  {checked && <span className="h-2 w-2 rounded-full bg-black" />}
                </span>
                <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                  Li, compreendo e aceito os termos acima.
                </span>
              </label>

              <button
                onClick={handleAccept}
                disabled={!checked}
                className="w-full rounded-xl py-3.5 text-sm font-semibold tracking-tight bg-primary text-black shadow-glow-sm transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Aceitar e Continuar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResponsibilityTerm;