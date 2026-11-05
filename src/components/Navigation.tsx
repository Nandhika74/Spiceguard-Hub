import React, { useState } from 'react';
import { ActiveTab } from '../types';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import {
  LayoutGrid,
  Flag,
  Calendar,
  Folder,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenAuth,
}) => {
  const { currentUser } = useRealtimeStore();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Overview', icon: LayoutGrid },
    { id: 'milestones' as ActiveTab, label: 'Milestones', icon: Flag },
    { id: 'meetings' as ActiveTab, label: 'Meetings', icon: Calendar },
    { id: 'documents' as ActiveTab, label: 'Docs', icon: Folder },
    { id: 'team' as ActiveTab, label: 'Team', icon: Users },
  ];

  const initials = currentUser.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Desktop Collapsible Left Sidebar (#09251B) */}
      <aside
        className={`hidden md:flex flex-col bg-[#09251B] border-r border-[#12382A] shrink-0 h-screen sticky top-0 p-3.5 justify-between select-none z-20 transition-all duration-200 ${
          collapsed ? 'w-[74px]' : 'w-64'
        }`}
      >
        <div className="space-y-6">
          {/* Brand Header + Collapse Toggle */}
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#103B2B] border border-[#1E5640] text-white flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-xs">
                SG
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="text-[14px] font-bold text-white tracking-tight leading-tight truncate">
                    SpiceGuard Hub
                  </h1>
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#86A898] mt-0.5 truncate">
                    Plant Lipids PoC
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-[#86A898] hover:text-white hover:bg-[#103B2B] transition shrink-0"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#103B2B] text-white font-semibold shadow-xs border border-[#1D543F]'
                      : 'text-[#8FAEA0] hover:text-white hover:bg-[#0E3023]'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#D97706]' : 'text-[#8FAEA0]'
                    }`}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Card */}
        <div className="pt-2">
          <div
            onClick={onOpenAuth}
            className={`flex items-center justify-between p-2 rounded-xl bg-[#0D2E22] border border-[#164232] hover:bg-[#103B2B] transition cursor-pointer group ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Switch User / Account"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#103B2B] border border-[#24634B] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0 text-left">
                  <p className="text-[12.5px] font-semibold text-white truncate leading-tight">
                    {currentUser.full_name}
                  </p>
                  <p className="text-[10.5px] text-[#86A898] truncate mt-0.5">
                    {currentUser.role}
                  </p>
                </div>
              )}
            </div>

            {!collapsed && (
              <LogOut className="w-3.5 h-3.5 text-[#86A898] group-hover:text-white transition shrink-0" />
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09251B]/95 backdrop-blur-md border-t border-[#164232] px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition ${
                isActive ? 'text-white font-semibold' : 'text-[#8FAEA0]'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-[#D97706]' : ''
                } transition-transform`}
              />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
