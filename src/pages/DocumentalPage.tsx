import ForensicModule from "@/components/dashboard/ForensicModule";

const DocumentalPage = () => (
  <ForensicModule
    type="documental"
    title="Análise Documental"
    subtitle="Extração inteligente de dados, pontos controvertidos e inconsistências."
    placeholder="Cole aqui o texto do documento a ser analisado (petição inicial, contestação, contrato, laudo contrário, etc.)..."
  />
);

export default DocumentalPage;
