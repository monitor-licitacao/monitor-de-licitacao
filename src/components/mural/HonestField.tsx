import React from 'react';

interface HonestFieldProps {
  value?: string | number | null;
  label: string;
  className?: string;
  fallbackClass?: string;
}

/**
 * HonestField ensures we never invent fake fallback data.
 * If value is absent or empty, displays an em dash (—) with an explicit aria-label.
 */
export const HonestField: React.FC<HonestFieldProps> = ({
  value,
  label,
  className = '',
  fallbackClass = 'text-slate-400 font-mono select-none'
}) => {
  if (value === null || value === undefined || value === '') {
    return (
      <span
        className={fallbackClass}
        aria-label={`${label} não informado`}
        title={`${label} não informado`}
      >
        —
      </span>
    );
  }

  return <span className={className}>{value}</span>;
};
