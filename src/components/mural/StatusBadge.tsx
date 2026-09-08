import React from 'react';
import { NormalizedStatus, StatusFamily } from '../../types/mural';

interface StatusBadgeProps {
  status?: NormalizedStatus | null;
  family?: string;
  code?: string;
  label?: string;
  isValid?: boolean;
  active?: boolean;
  size?: 'sm' | 'md';
}

const FAMILY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PregaoEletronico: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200'
  },
  ProcessosPresenciais: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200'
  },
  ProcessoDeContratacao: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200'
  },
  CotacaoDeOrcamento: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200'
  },
  CompraDireta: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200'
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  family: propFamily,
  code: propCode,
  label: propLabel,
  isValid: propIsValid,
  active = true,
  size = 'md'
}) => {
  const family = status?.family || propFamily || '';
  const code = status?.code || propCode || '';
  const label = status?.label || propLabel || '';
  const isValid = status !== undefined ? (status?.is_valid ?? true) : (propIsValid ?? true);

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[11px]' 
    : 'px-2.5 py-1 text-xs';

  // Fail-closed: if invalid or code unknown
  if (!isValid || !label) {
    return (
      <span
        title={code ? `Status inválido (${code})` : 'Status inválido'}
        aria-label={`Status inválido: ${code || 'não reconhecido'}`}
        className={`inline-flex items-center gap-1.5 font-medium rounded-md border bg-slate-100 text-slate-700 border-slate-300 ${sizeClasses}`}
      >
        <span>Status inválido</span>
        {code && <span className="font-mono text-[10px] text-slate-500">[{code}]</span>}
      </span>
    );
  }

  // Deactivated status representation
  if (active === false) {
    return (
      <span
        title={`${family} · ${code} (Inativo)`}
        aria-label={`Status inativo: ${label}`}
        className={`inline-flex items-center gap-1 font-medium rounded-md border bg-slate-100 text-slate-500 border-slate-200 line-through ${sizeClasses}`}
      >
        <span>{label}</span>
        <span className="text-[10px] no-underline font-normal text-slate-400">(Inativo)</span>
      </span>
    );
  }

  const colors = FAMILY_COLORS[family] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200'
  };

  const tooltipText = family && code ? `${family} · ${code}` : (code || family || label);

  return (
    <span
      title={tooltipText}
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center font-semibold rounded-md border ${colors.bg} ${colors.text} ${colors.border} shadow-2xs ${sizeClasses}`}
    >
      {label}
    </span>
  );
};
