import React from 'react';
import { CheckCircle2, AlertTriangle, Database, Clock } from 'lucide-react';
import type { EnrichmentBadge as BadgeType } from '../../types/contratacoes';

const BADGE_CONFIG: Record<
  BadgeType,
  { label: string; bg: string; text: string; border: string; icon: React.ElementType }
> = {
  PNCP_SUFFICIENT: {
    label: 'PNCP suficiente',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  ENRICHMENT_PARTIAL: {
    label: 'Enriquecimento parcial',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: AlertTriangle,
  },
  CG_METADATA: {
    label: 'CG metadata',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    icon: Database,
  },
  PENDING: {
    label: 'Pendente',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    icon: Clock,
  },
};

interface EnrichmentBadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md';
}

export const EnrichmentBadge: React.FC<EnrichmentBadgeProps> = ({ badge, size = 'md' }) => {
  const config = BADGE_CONFIG[badge] ?? BADGE_CONFIG.PENDING;
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      title={config.label}
      className={`inline-flex items-center gap-1 font-semibold rounded-md border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      {config.label}
    </span>
  );
};
