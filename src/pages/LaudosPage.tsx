import ForensicModule from "@/components/dashboard/ForensicModule";

const LaudosPage = () => (
  <ForensicModule
    type="laudo"
    title="Geração de Laudos"
    subtitle="Gere laudos técnicos periciais estruturados prontos para o tribunal."
    placeholder="Descreva o caso, as evidências analisadas, os quesitos a responder e demais informações relevantes para a geração do laudo pericial..."
  />
);

export default LaudosPage;
