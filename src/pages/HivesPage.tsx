import ForensicModule from "@/components/dashboard/ForensicModule";

const HivesPage = () => (
  <ForensicModule
    type="hives"
    title="Leitura de Hives"
    subtitle="Análise forense de registros do Windows (SAM, SYSTEM, SOFTWARE, NTUSER)."
    placeholder="Cole aqui o conteúdo extraído dos registros do Windows (hives). Ex: saída do RegRipper, exportação do Registry Editor, ou conteúdo do SAM/SYSTEM/NTUSER..."
  />
);

export default HivesPage;
