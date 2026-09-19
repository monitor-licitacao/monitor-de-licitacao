import React from 'react';
import { Play } from 'lucide-react';
import { SchedulerState } from '../types';

interface HeaderProps {
  scheduler: SchedulerState;
  onTriggerScheduler: () => void;
  isTriggering: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  scheduler,
  onTriggerScheduler,
  isTriggering
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-xs">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-sm text-white shadow-xs">
            MEM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center">
                Monitor de Editais Municipais
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50 font-bold uppercase tracking-wider hidden md:inline">
                NCM 9506.91
              </span>
            </div>
          </div>
        </div>

        {/* Right Status & Scheduler Quick Actions */}
        <div className="flex items-center gap-3 sm:gap-5 text-xs">
          <div className="hidden md:flex items-center gap-2 text-slate-300">
            <span className={`w-2 h-2 rounded-full ${scheduler.isRunning ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-[11px]">Scheduler: <strong className="text-green-400">Operacional</strong></span>
          </div>

          <button
            onClick={onTriggerScheduler}
            disabled={isTriggering}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            title="Executar varredura em tempo real em todas as 28 prefeituras e portais"
          >
            <Play className={`w-3 h-3 ${isTriggering ? 'animate-spin' : ''}`} />
            <span>{isTriggering ? 'Coletando...' : 'Executar Coleta'}</span>
          </button>

          <div className="w-7 h-7 bg-slate-700 rounded-full border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shadow-xs">
            JD
          </div>
        </div>
      </div>
    </header>
  );
};

