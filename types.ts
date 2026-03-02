
export interface SheetRow {
  [key: string]: string | number | Date | undefined;
}

export interface InvalidRow {
  identificadorLinha: string;
  primeiraColunaDado?: string;
  nomePrograma?: string;
  descricaoProblema: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartData {
  title: string;
  type: 'bar' | 'pie';
  data: ChartDataPoint[];
}

export interface AnalysisResultData {
  resumo: string;
  dadosInvalidos: InvalidRow[];
  chart?: ChartData;
}

export interface Filter {
  id: number;
  column: string;
  value: string | { start?: string; end?: string };
}

export const typeMapping: { [key: string]: string } = {
  G: 'Gravado',
  V: 'Ao Vivo',
  C: 'Cancelado',
};
