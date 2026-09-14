import React, { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { maskPncpInput } from '../../types/pipeline';

interface PipelineImportModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onImport: (numeroControlePncp: string) => void;
}

export const PipelineImportModal: React.FC<PipelineImportModalProps> = ({
  open,
  loading,
  onClose,
  onImport,
}) => {
  const [value, setValue] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Importar por ID do PNCP</h3>
          <p className="mt-1 text-sm text-slate-600">
            Cole o número de controle do PNCP do edital. Trazemos para o seu pipeline, mesmo que já tenha saído de Contratações.
          </p>
        </div>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: 00000000000191-1-000001/2026"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(maskPncpInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim() && !loading) onImport(value.trim());
          }}
          autoFocus
          disabled={loading}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              if (!loading) {
                setValue('');
                onClose();
              }
            }}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
            onClick={() => onImport(value.trim())}
            disabled={!value.trim() || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
};
