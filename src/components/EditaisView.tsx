import React, { useState, useEffect } from 'react';
import { MuralCardsView } from './mural/MuralCardsView';
import { ProcessDetailView } from './mural/ProcessDetailView';

interface EditaisViewProps {
  selectedProcessCodigo?: string | null;
  onSelectProcessCodigo?: (codigo: string | null) => void;
}

/**
 * EditaisView: Refactored according to Mural v1 Specification.
 * Displays MuralCard MVP compact grid and ProcessDetailView v2 on selection.
 * Clutter (OCR %, NCM test, raw pipeline) has been removed from cards.
 */
export const EditaisView: React.FC<EditaisViewProps> = ({
  selectedProcessCodigo: propCodigo,
  onSelectProcessCodigo: propOnSelect
}) => {
  const [internalCodigo, setInternalCodigo] = useState<string | null>(null);

  const currentCodigo = propCodigo !== undefined ? propCodigo : internalCodigo;

  const handleOpenDetail = (codigo: string) => {
    if (propOnSelect) {
      propOnSelect(codigo);
    } else {
      setInternalCodigo(codigo);
      if (window.location.pathname !== `/processos/${codigo}`) {
        window.history.pushState(null, '', `/processos/${codigo}`);
      }
    }
  };

  const handleBack = () => {
    if (propOnSelect) {
      propOnSelect(null);
    } else {
      setInternalCodigo(null);
      if (window.location.pathname.startsWith('/processos/')) {
        window.history.pushState(null, '', '/');
      }
    }
  };

  if (currentCodigo) {
    return (
      <ProcessDetailView
        identifier={currentCodigo}
        onBack={handleBack}
      />
    );
  }

  return (
    <MuralCardsView
      onOpenDetail={handleOpenDetail}
    />
  );
};
