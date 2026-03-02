import React from 'react';
import type { SheetRow } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { typeMapping } from '../types';

interface DataTableProps {
  data: SheetRow[];
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  const { theme } = useTheme();

  if (data.length === 0) {
    return null;
  }

  const headers = Object.keys(data[0]).filter(header => header !== '__originalRowIndex');

  return (
    <div className={`w-full overflow-hidden border ${theme.classNames.border} rounded-lg`}>
      <div className="overflow-x-auto max-h-80">
        <table className={`min-w-full text-sm divide-y ${theme.classNames.border}`}>
          <thead className="bg-blue-800 sticky top-0">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className={`px-4 py-3 text-left text-xs font-medium ${theme.classNames.text.muted} uppercase tracking-wider`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`${theme.classNames.background.card} divide-y ${theme.classNames.border}`}>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={theme.classNames.background.highlight}>
                {headers.map((header) => {
                  const cellValue = row[header];
                  
                  let displayValue;
                  if (header.toLowerCase().includes('tipo') && typeof cellValue === 'string' && typeMapping[cellValue.toUpperCase()]) {
                    displayValue = typeMapping[cellValue.toUpperCase()];
                  } else if (cellValue instanceof Date) {
                    displayValue = cellValue.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                  } else {
                    displayValue = cellValue;
                  }

                  return (
                    <td
                      key={`${rowIndex}-${header}`}
                      className={`px-4 py-3 whitespace-nowrap ${theme.classNames.text.base}`}
                    >
                      {displayValue === null || displayValue === undefined ? '' : String(displayValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;