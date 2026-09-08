import React from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';

interface CanonicalSourceActionProps {
  url?: string | null;
  fonteConfirmada?: boolean;
  className?: string;
  variant?: 'card' | 'header';
}

export const CanonicalSourceAction: React.FC<CanonicalSourceActionProps> = ({
  url,
  fonteConfirmada = true,
  className = '',
  variant = 'card'
}) => {
  const isValidUrl = Boolean(
    url &&
    url.trim().length > 0 &&
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !url.includes('example.com') &&
    !url.includes('mock')
  );

  const isConfirmed = Boolean(fonteConfirmada && isValidUrl);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent opening card detail when clicking external link action
    e.stopPropagation();
  };

  if (!isConfirmed) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
          title="Esta fonte não foi verificada no portal oficial do Sistema S ou ComprasNet"
          aria-label="Fonte não confirmada"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
          <span>Fonte não confirmada</span>
        </span>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Link canônico não confirmado"
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60"
        >
          <span>Abrir fonte</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <a
      href={url!}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Abrir fonte oficial em nova aba"
      title={`Abrir fonte oficial: ${url}`}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors shadow-2xs ${className}`}
    >
      <span>Abrir fonte</span>
      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden="true" />
    </a>
  );
};
