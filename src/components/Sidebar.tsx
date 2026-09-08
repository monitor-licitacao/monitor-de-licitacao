import React, { useState } from 'react';
import { 
  Menu,
  Activity, 
  Building2, 
  FileText, 
  Scale, 
  Sparkles,
  UserCheck, 
  GitCompare, 
  MessageSquare, 
  Dumbbell,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewCount: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pendingReviewCount, onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Painel Geral', icon: Activity },
    { id: 'crm', label: 'RevOps & CRM', icon: BarChart3, badge: 'Novo' },
    { id: 'sources', label: 'Conectores', icon: Building2 },
    { id: 'editais', label: 'Editais', icon: FileText },
    { id: 'findings', label: 'Achados', icon: Scale },
    { id: 'tech-spec-ai', label: 'Tech AI', icon: Sparkles },
    { id: 'review', label: 'Revisão', icon: UserCheck, badge: pendingReviewCount > 0 ? String(pendingReviewCount) : undefined, highlight: pendingReviewCount > 0 },
    { id: 'diff', label: 'Diffs', icon: GitCompare },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'ncm-config', label: 'Configurações Globais', icon: Dumbbell }
  ];

  return (
    <div className={`bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300 flex flex-col ${isCollapsed ? 'w-16' : 'w-64'}`}>
      <div className="h-12 flex items-center justify-between px-3 border-b border-slate-800">
        {!isCollapsed && <span className="font-bold text-slate-100 text-sm tracking-tight truncate">Menu Principal</span>}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors ml-auto">
          {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={isCollapsed ? tab.label : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                {isCollapsed && tab.highlight && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border-2 border-slate-900"></span>
                )}
              </div>
              
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between truncate">
                  <span className="truncate">{tab.label}</span>
                  {tab.badge && (
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      tab.highlight 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>
      
      <div className="p-3 border-t border-slate-800 space-y-2">
        {!isCollapsed && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Workspace</div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-linear-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-xs shadow-lg">T1</div>
              <div className="flex-1 truncate">
                <div className="text-sm font-bold text-slate-200 truncate">Vectra Cargo</div>
                <div className="text-[10px] text-slate-400">NCM 9506.91</div>
              </div>
            </div>
          </div>
        )}
        {onLogout && (
          <button type="button"
            onClick={onLogout}
            title="Sair do sistema"
            data-testid="sidebar-logout-button"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        )}
      </div>
    </div>
  );
};
