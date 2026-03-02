
import { GoogleGenAI, Type } from "@google/genai";
import type { SheetRow, AnalysisResultData, Filter, InvalidRow, ChartData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const typeMapping: { [key: string]: string } = {
  G: 'Gravado',
  V: 'Ao Vivo',
  C: 'Cancelado',
};

const singleChartSchema = {
    type: Type.OBJECT,
    description: "Um objeto de dados para visualização (gráfico de barras ou de pizza). Gere apenas UM gráfico que melhor compare os dados para responder à pergunta.",
    properties: {
        title: { type: Type.STRING, description: "O título do gráfico (ex: 'Horas Totais por Equipe')." },
        type: { type: Type.STRING, description: "O tipo de gráfico, 'bar' para barras ou 'pie' para pizza." },
        data: {
            type: Type.ARRAY,
            description: "Os pontos de dados para o gráfico.",
            items: {
                type: Type.OBJECT,
                properties: {
                    label: { type: Type.STRING, description: "O rótulo para o ponto de dado." },
                    value: { type: Type.NUMBER, description: "O valor numérico para o ponto de dado." }
                },
                required: ['label', 'value']
            }
        }
    },
    required: ['title', 'type', 'data']
};

const analysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        resumo: {
            type: Type.STRING,
            description: "Um relatório conciso e bem estruturado. Use títulos em negrito (ex: **Título da Seção**) para separar as diferentes partes da resposta. IMPORTANTE: Use listas de marcadores (formato Markdown com '-') para apresentar CADA item de dado ou total individualmente. É EXTREMAMENTE IMPORTANTE pular uma linha em branco (usar \\n\\n) DEPOIS de CADA item da lista e DEPOIS de cada seção para garantir que o texto fique bem espaçado e legível. Apresente todos os horários estritamente no formato 'hh:mm'. Na última linha, inclua o período analisado.",
        },
        dadosInvalidos: {
            type: Type.ARRAY,
            description: "Uma lista de linhas que parecem ter dados inconsistentes ou inválidos. Inconsistências comuns incluem: horários de término antes dos horários de início, durações que não correspondem aos horários de início/fim, valores ausentes em colunas essenciais como 'programa' ou 'estudio', ou formatos de data/hora irreconhecíveis. Para cada linha, forneça o 'rowIndex' como 'identificadorLinha' e uma descrição clara e concisa do problema. Se não houver problemas, retorne um array vazio.",
            items: {
                type: Type.OBJECT,
                properties: {
                    identificadorLinha: {
                        type: Type.STRING,
                        description: "O identificador 'rowIndex' da linha com problema."
                    },
                    primeiraColunaDado: {
                        type: Type.STRING,
                        description: "O valor exato da primeira coluna da linha com problema. Geralmente é a data. Isso ajuda a localizar a linha facilmente."
                    },
                    nomePrograma: {
                        type: Type.STRING,
                        description: "O valor da coluna 'programa' da linha com problema. Se o programa estiver faltando, retorne uma string indicando 'Programa não informado'."
                    },
                    descricaoProblema: {
                        type: Type.STRING,
                        description: "Uma breve descrição do dado inválido ou inconsistente encontrado."
                    }
                },
                required: ['identificadorLinha', 'primeiraColunaDado', 'nomePrograma', 'descricaoProblema'],
            }
        },
        chart: singleChartSchema,
    },
    required: ['resumo', 'dadosInvalidos', 'chart'],
};

async function synthesizeSummaries(
    partialSummaries: string[], 
    userPrompt: string, 
    filtersDescription: string,
    periodoAnalise: string,
    additionalContext?: string
): Promise<string> {
    const synthesisPrompt = `
      Você é um analista de dados sênior. Sua tarefa é consolidar vários resumos parciais de uma análise de dados em um único relatório final coeso e abrangente.

      **Contexto da Análise Original:**
      - Pergunta do usuário: "${userPrompt}"
      ${additionalContext ? `- Informações Adicionais/Parâmetros: "${additionalContext}"` : ''}
      - ${filtersDescription}
      - ${periodoAnalise}

      **Resumos Parciais (de diferentes partes da planilha):**
      ${partialSummaries.map((s, i) => `--- Resumo da Parte ${i + 1} ---\n${s}`).join('\n\n')}

      **Sua Tarefa:**
      1.  **Sintetize:** Leia todos os resumos parciais. Agregue os números, combine as listas e consolide os insights. Não apenas liste os resumos; crie um novo relatório unificado.
      2.  **Responda à Pergunta:** Certifique-se de que o relatório final responda diretamente à pergunta original do usuário e considere os parâmetros adicionais fornecidos.
      3.  **Formatação Clara (CRÍTICO):** 
          - Use títulos em negrito (ex: **Métricas Gerais**) para separar seções.
          - Use listas de marcadores ('-') para CADA métrica ou dado individual.
          - **Regra de Ouro do Espaçamento:** Insira DUAS quebras de linha (\\n\\n) APÓS CADA item da lista e APÓS CADA seção. O texto deve ser muito arejado.
          - **Uma informação por linha:** Apresente CADA dado em sua própria linha isolada. Não agrupe múltiplos dados na mesma linha.
          - **Formato de Tempo:** Use estritamente 'hh:mm' para apresentar todas as horas e durações.
      4.  **Inclua o Contexto:** Comece o relatório final com a seção **Filtros Aplicados:** (se houver) e termine com a linha do período analisado.

      A resposta deve ser APENAS o texto do relatório final consolidado, em português do Brasil.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: synthesisPrompt,
            config: {
                systemInstruction: "Você é um assistente de análise de dados especialista em produção de TV. Você prioriza clareza visual, usando muitas quebras de linha e formato de hora hh:mm.",
                thinkingConfig: { thinkingBudget: 8192 },
            },
        });
        
        if (!response || typeof response.text !== 'string' || !response.text.trim()) {
            throw new Error(`A IA falhou ao consolidar os resultados.`);
        }
        return response.text.trim();
    } catch (error) {
        console.error("Error during synthesis:", error);
        throw new Error("Falha ao consolidar os resultados da análise com a IA.");
    }
}

export const analyzeSpreadsheetData = async (
    data: SheetRow[], 
    userPrompt: string, 
    filters: Filter[], 
    periodoAnalise: string,
    onProgress?: (progress: { current: number; total: number, step: 'analyze' | 'synthesize' }) => void,
    additionalContext?: string
): Promise<AnalysisResultData> => {
    
    const filtersDescription = filters.length > 0
        ? `A análise foi pré-filtrada com os seguintes critérios: ${filters.map(f => {
            if (typeof f.value === 'object' && f.value !== null) {
                const { start, end } = f.value as { start?: string, end?: string };
                const formatDate = (dateStr: string | undefined) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
                return `${f.column} entre ${formatDate(start)} e ${formatDate(end)}`;
            }
            return `${f.column} = "${f.value}"`;
          }).join(', ')}.`
        : "A análise está sendo feita no conjunto de dados completo.";
    
    const analyzeChunk = async (chunkData: SheetRow[], isChunked: boolean, chunkInfo: string): Promise<AnalysisResultData> => {
        const prompt = `
      Você é um analista de dados sênior. Sua tarefa é analisar uma planilha com registros de gravações de estúdio e retornar um relatório numérico e EXATAMENTE UM gráfico comparativo principal.

      **Colunas de Interesse Principal:**
      As colunas principais incluem 'equipe', 'programa', 'estudio', 'data', 'hora inicial', 'duracao_horas', 'tipo'.

      **Mapeamento da Coluna 'tipo' (CRÍTICO):**
      - 'G' = Gravado
      - 'V' = Ao Vivo
      - 'C' = Cancelado
      Sempre use os nomes por extenso (Gravado, Ao Vivo, Cancelado) no seu resumo e análise, a menos que se refira ao dado bruto.

      **Informações Adicionais e Parâmetros (CRÍTICO):**
      "${additionalContext || 'Nenhum contexto adicional fornecido.'}"

      **Instruções de Análise de Equipe:**
      - Se houver a coluna 'equipe', analise quais equipes são as mais produtivas (mais horas gravadas).
      - Identifique se alguma equipe específica tem um alto índice de cancelamentos (Tipo 'C').
      - Apresente totais acumulados por equipe se a pergunta do usuário for sobre faturamento ou horas trabalhadas.

      ${isChunked ? `**Contexto de Análise em Partes:**\nVocê está analisando uma parte (${chunkInfo}) de um conjunto de dados maior.\n` : ''}

      **Contexto da Análise:**
      ${filtersDescription}
      A planilha contém ${chunkData.length} linhas após a filtragem.
      ${periodoAnalise}

      **Regras de Validação:**
      - Se Tipo='C' (Cancelado), ignore valores em colunas '(res)'. Verifique se existem valores em colunas '(Rea)'.
      - Formato de Tempo: Use estritamente 'hh:mm'.

      Dados JSON:
      ${JSON.stringify(chunkData.map(row => {
          const { __originalRowIndex, ...rest } = row;
          return { ...rest, rowIndex: __originalRowIndex };
      }))}

      Pergunta do usuário:
      "${userPrompt}"

      **Gráfico Único (chart):**
      - Gere apenas UM gráfico que melhor responda à pergunta, comparando as categorias relevantes.
    `;
    
      try {
          const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: {
                  systemInstruction: "Você é um especialista em TV. Suas respostas devem ser JSON. Considere o contexto adicional e a pergunta principal. Gere EXATAMENTE UM gráfico comparativo no campo 'chart'.",
                  responseMimeType: "application/json",
                  responseSchema: analysisResponseSchema,
                  thinkingConfig: { thinkingBudget: 8192 },
              },
          });
          
          if (!response || !response.text?.trim()) {
              throw new Error(`A IA não retornou uma resposta válida.`);
          }
          
          return JSON.parse(response.text.trim()) as AnalysisResultData;
      } catch (error: any) {
          throw new Error("Falha ao comunicar com o serviço de IA.");
      }
    };
    
    const CHUNK_SIZE = 1500;
    if (data.length <= CHUNK_SIZE) {
        onProgress?.({ current: 1, total: 1, step: 'analyze' });
        return await analyzeChunk(data, false, '');
    }

    const chunks: SheetRow[][] = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) chunks.push(data.slice(i, i + CHUNK_SIZE));

    const partialSummaries: string[] = [];
    const allInvalidRows: InvalidRow[] = [];
    const allCharts: ChartData[] = [];

    for (let i = 0; i < chunks.length; i++) {
        onProgress?.({ current: i + 1, total: chunks.length, step: 'analyze' });
        const result = await analyzeChunk(chunks[i], true, `Parte ${i+1}`);
        if (result.resumo) partialSummaries.push(result.resumo);
        if (result.dadosInvalidos) allInvalidRows.push(...result.dadosInvalidos);
        if (result.chart) allCharts.push(result.chart);
    }
    
    let finalChart: ChartData | undefined;
    if (allCharts.length > 0) {
        const chartMap = new Map<string, { type: 'bar' | 'pie'; data: Map<string, number> }>();
        allCharts.forEach(chart => {
            if (!chartMap.has(chart.title)) chartMap.set(chart.title, { type: chart.type, data: new Map() });
            const existing = chartMap.get(chart.title)!;
            chart.data.forEach(p => existing.data.set(p.label, (existing.data.get(p.label) || 0) + p.value));
        });
        
        const firstEntry = Array.from(chartMap.entries())[0];
        if (firstEntry) {
            const [title, v] = firstEntry;
            finalChart = { 
                title, 
                type: v.type, 
                data: Array.from(v.data.entries()).map(([label, value]) => ({ label, value })) 
            };
        }
    }

    onProgress?.({ current: 1, total: 1, step: 'synthesize' });
    const finalResumo = await synthesizeSummaries(partialSummaries, userPrompt, filtersDescription, periodoAnalise, additionalContext);

    return { resumo: finalResumo, dadosInvalidos: allInvalidRows, chart: finalChart };
};

export const correctUserPrompt = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Corrija a seguinte pergunta: "${prompt}"`,
            config: { systemInstruction: "Corrija a gramática e clareza, mantendo o significado. Retorne apenas o texto." },
        });
        return response.text?.trim() || prompt;
    } catch {
        return prompt;
    }
};
