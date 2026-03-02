
import React, { useState, useEffect } from 'react';
import type { SheetRow } from '../types';

const genericMessages = [
  "Analisando dados...",
  "Buscando insights...",
  "Calculando totais...",
  "Cruzando informações...",
  "Montando relatório...",
];

interface AnalysisAnimationProps {
  sheetData: SheetRow[];
  fileName: string;
  analysisProgress: {current: number, total: number, step: string} | null;
}

const AnalysisAnimation: React.FC<AnalysisAnimationProps> = ({ sheetData, fileName, analysisProgress }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
    // Este intervalo é um fallback para análises de bloco único ou se a propriedade de progresso não estiver disponível
    const messageInterval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % genericMessages.length);
    }, 2500);

    const timeouts: number[] = [];
    if (!analysisProgress) {
      timeouts.push(window.setTimeout(() => setLocalProgress(20), 100));
      timeouts.push(window.setTimeout(() => setLocalProgress(50), 1800));
      timeouts.push(window.setTimeout(() => setLocalProgress(85), 3800));
      timeouts.push(window.setTimeout(() => setLocalProgress(95), 5500));
    }

    return () => {
      clearInterval(messageInterval);
      timeouts.forEach(clearTimeout);
    };
  }, [analysisProgress]);

  const rowCount = sheetData.length;
  const colCount = rowCount > 0 ? Object.keys(sheetData[0]).length : 0;

  const progressPercentage = analysisProgress 
    ? analysisProgress.step === 'analyze' 
        ? Math.round(((analysisProgress.current - 1) / analysisProgress.total) * 90) // A análise leva até 90%
        : 95 // A síntese corresponde aos 5% finais
    : localProgress;

  const statusMessage = analysisProgress
    ? analysisProgress.total > 1
      ? analysisProgress.step === 'analyze'
        ? `Analisando parte ${analysisProgress.current} de ${analysisProgress.total}...`
        : "Consolidando resultados..."
      : genericMessages[messageIndex]
    : genericMessages[messageIndex];

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 text-center w-full">
      <div className="relative w-48 h-32">
        {/* Fundo da Grade */}
        <div className="grid grid-cols-6 grid-rows-4 gap-1 w-full h-full">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="bg-blue-800/50 rounded-sm animate-cell-pop"
              style={{ animationDelay: `${Math.random() * 2}s` }}
            >
              <span className="text-amber-400 text-xs opacity-0">
                {Math.floor(Math.random() * 9) + 1}
              </span>
            </div>
          ))}
        </div>
        {/* Lupa */}
        <div className="magnifying-glass absolute top-0 left-0">
          <svg
            className="w-16 h-16 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
      </div>

      {rowCount > 0 && (
          <div className="w-full max-w-md text-sm text-slate-400 bg-blue-950/50 p-4 rounded-lg border border-blue-700">
              <div className="flex justify-between items-center">
                  <span>Analisando arquivo:</span>
                  <span className="font-mono text-amber-400 bg-blue-800 px-2 py-0.5 rounded truncate max-w-[150px] sm:max-w-xs" title={fileName}>{fileName}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-blue-800/50">
                  <span><span className="font-semibold text-slate-300">{rowCount.toLocaleString('pt-BR')}</span> linhas</span>
                  <span><span className="font-semibold text-slate-300">{colCount}</span> colunas</span>
              </div>
          </div>
      )}

      <p className="text-slate-400 text-lg font-medium tracking-wide status-text">
        {statusMessage}
      </p>

      <div className="w-full max-w-md">
        <div className="w-full bg-blue-800 rounded-full h-2.5">
          <div
            className="bg-amber-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <p className="text-sm text-amber-400 font-mono mt-2">{progressPercentage}% concluído</p>
      </div>
    </div>
  );
};

export default AnalysisAnimation;