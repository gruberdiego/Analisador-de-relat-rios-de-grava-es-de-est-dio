



import React, { useState, useMemo } from 'react';
import type { Filter } from '../types';
import { CloseIcon, PlusIcon } from './Icons';
import { typeMapping } from '../types';

interface FilterControlsProps {
  availableColumns: string[];
  columnValues: Record<string, string[]>;
  activeFilters: Filter[];
  onAddFilter: (filter: Omit<Filter, 'id'>) => void;
  onRemoveFilter: (filterId: number) => void;
  disabled: boolean;
}

const isDateColumn = (columnName: string) => columnName.toLowerCase().includes('data');

const FilterControls: React.FC<FilterControlsProps> = ({
  availableColumns,
  columnValues,
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  disabled,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  
  // Estado para filtros de valor único
  const [selectedValue, setSelectedValue] = useState<string>('');

  // Estado para filtros de intervalo de datas
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');


  const availableColumnsForNewFilter = useMemo(() => {
    const activeColumns = new Set(activeFilters.map(f => f.column));
    return availableColumns.filter(col => !activeColumns.has(col));
  }, [availableColumns, activeFilters]);

  const handleAddClick = () => {
    // Reseta o estado e define a coluna padrão
    const defaultColumn = availableColumnsForNewFilter[0] || '';
    setSelectedColumn(defaultColumn);
    setSelectedValue('');
    setStartDate('');
    setEndDate('');
    setShowAddForm(true);
  };

  const handleApplyFilter = () => {
    if (!selectedColumn) return;

    if (isDateColumn(selectedColumn)) {
      if (startDate || endDate) {
        onAddFilter({ column: selectedColumn, value: { start: startDate || undefined, end: endDate || undefined } });
      }
    } else {
      if (selectedValue) {
        onAddFilter({ column: selectedColumn, value: selectedValue });
      }
    }

    setShowAddForm(false);
    setSelectedColumn('');
    setSelectedValue('');
    setStartDate('');
    setEndDate('');
  };
  
  const handleColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedColumn(e.target.value);
      setSelectedValue('');
      setStartDate('');
      setEndDate('');
  }
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleApplyFilter();
  }

  const optionsForSelectedColumn = useMemo(() => {
    const values = columnValues[selectedColumn] || [];
    if (selectedColumn.toLowerCase().includes('tipo')) {
      return values.map(val => ({
        value: String(val),
        label: typeMapping[String(val).toUpperCase()] || val,
      }));
    }
    return values.map(val => ({ value: String(val), label: String(val) }));
  }, [selectedColumn, columnValues]);

  if (availableColumns.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {activeFilters.map(filter => {
            let displayValue: string;
            if (typeof filter.value === 'object' && filter.value !== null) {
                const { start, end } = filter.value;
                const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '...';
                if (start && end) {
                    displayValue = `${formatDate(start)} - ${formatDate(end)}`;
                } else if (start) {
                    displayValue = `a partir de ${formatDate(start)}`;
                } else if (end) {
                    displayValue = `até ${formatDate(end)}`;
                } else {
                    displayValue = 'Intervalo de data inválido';
                }
            } else {
                displayValue = filter.value as string;
                if (filter.column.toLowerCase().includes('tipo') && typeMapping[displayValue.toUpperCase()]) {
                    displayValue = typeMapping[displayValue.toUpperCase()];
                }
            }

          return (
            <div key={filter.id} className="flex items-center gap-1.5 bg-blue-800 text-slate-200 text-sm font-medium px-2.5 py-1 rounded-full">
              <span>{filter.column}: <span className="font-normal text-slate-300">{displayValue}</span></span>
              <button
                onClick={() => onRemoveFilter(filter.id)}
                className="rounded-full hover:bg-blue-700 p-0.5"
                aria-label={`Remover filtro ${filter.column}`}
                disabled={disabled}
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {!showAddForm && availableColumnsForNewFilter.length > 0 && (
          <button
            onClick={handleAddClick}
            disabled={disabled}
            className="flex items-center gap-1 text-sm font-semibold text-amber-400 border-2 border-dashed border-blue-700 rounded-full px-3 py-1 hover:bg-blue-800/50 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <PlusIcon className="w-4 h-4" />
            Adicionar Filtro
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row items-end gap-2 p-3 bg-blue-950/50 rounded-lg border border-blue-700">
          <div className="flex-shrink-0">
              <label htmlFor="column-select" className="text-xs text-slate-400 block mb-1">Coluna</label>
              <select
                id="column-select"
                value={selectedColumn}
                onChange={handleColumnChange}
                className="w-full sm:w-48 p-2 border border-blue-700 bg-blue-900 text-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 text-sm"
              >
                <option value="" disabled>Selecione</option>
                {availableColumnsForNewFilter.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
          </div>
          
          {isDateColumn(selectedColumn) ? (
            <div className="flex flex-1 flex-col sm:flex-row gap-2">
                <div className="flex-1">
                    <label htmlFor="start-date" className="text-xs text-slate-400 block mb-1">Data de Início</label>
                    <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full p-2 border border-blue-700 bg-blue-900 text-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 text-sm disabled:opacity-50"
                        disabled={!selectedColumn}
                    />
                </div>
                <div className="flex-1">
                    <label htmlFor="end-date" className="text-xs text-slate-400 block mb-1">Data Final</label>
                    <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate || ''}
                        className="w-full p-2 border border-blue-700 bg-blue-900 text-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 text-sm disabled:opacity-50"
                        disabled={!selectedColumn}
                    />
                </div>
            </div>
          ) : (
            <div className="flex-1">
                <label htmlFor="value-select" className="text-xs text-slate-400 block mb-1">Valor</label>
                {optionsForSelectedColumn.length > 0 && optionsForSelectedColumn.length < 50 ? (
                    <select
                        id="value-select"
                        value={selectedValue}
                        onChange={(e) => setSelectedValue(e.target.value)}
                        disabled={!selectedColumn}
                        className="w-full p-2 border border-blue-700 bg-blue-900 text-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 text-sm disabled:opacity-50"
                    >
                        <option value="" disabled>Selecione</option>
                        {optionsForSelectedColumn.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        id="value-select"
                        type="text"
                        value={selectedValue}
                        onChange={(e) => setSelectedValue(e.target.value)}
                        placeholder="Digite um valor..."
                        disabled={!selectedColumn}
                        className="w-full p-2 border border-blue-700 bg-blue-900 text-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 text-sm placeholder-slate-500 disabled:opacity-50"
                    />
                )}
            </div>
          )}

          <div className="flex gap-2 self-end pt-2 sm:pt-0">
             <button type="button" onClick={handleApplyFilter} disabled={isDateColumn(selectedColumn) ? (!startDate && !endDate) : !selectedValue} className="bg-amber-500 text-blue-950 font-semibold py-2 px-3 rounded-md hover:bg-amber-600 disabled:opacity-60 text-sm">Aplicar</button>
             <button type="button" onClick={() => setShowAddForm(false)} className="bg-blue-700 text-white font-semibold py-2 px-3 rounded-md hover:bg-blue-600 text-sm">Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FilterControls;