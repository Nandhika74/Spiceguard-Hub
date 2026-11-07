import React, { useState } from 'react';
import { ActiveTab } from '../types';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { NotificationDropdown } from './NotificationDropdown';
import { Bell, Calendar, Zap, Users } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenAuth: () => void;
  onOpenConnection: () => void;
}

const TAB_TITLES: Record<ActiveTab, string> = {
  dashboard: 'Overview',
  milestones: 'Milestones',
  meetings: 'Meetings',
  documents: 'Docs',
  team: 'Team',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenAuth,
  onOpenConnection: _onOpenConnection,
}) => {
  const {
    currentUser,
    notifications,
    onlineUsers,
    liveCollaborationAlert,
    dismissLiveAlert,
    isRealtimeConnected,
  } = useRealtimeStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const initials = currentUser.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Floating Live Collaboration Alert Banner */}
      {liveCollaborationAlert && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#103B2B] text-white px-4 py-2 rounded-full shadow-2xl border border-emerald-400/50 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="truncate max-w-xs sm:max-w-md">{liveCollaborationAlert.message}</span>
          <button
            onClick={dismissLiveAlert}
            className="text-emerald-300 hover:text-white px-1 font-bold text-sm leading-none"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <header className="px-6 sm:px-8 pt-5 pb-3 flex items-center justify-between border-b border-[#E3E7E1] bg-[#F5F7F4]/90 backdrop-blur-xs sticky top-0 z-10">
        {/* Left Title */}
        <div className="flex items-center gap-3">
          <div className="md:hidden w-8 h-8 rounded-lg bg-[#103B2B] text-white flex items-center justify-center font-bold text-xs">
            SG
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#103B2B] tracking-tight">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Real-time Presence / Live Sync Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#E3E7E1] text-xs font-semibold text-stone-700 shadow-2xs cursor-default"
            title={
              onlineUsers.length > 0
                ? `Connected: ${onlineUsers.map((u) => u.full_name.split(' ')[0]).join(', ')}`
                : 'Real-time WebSocket sync active'
            }
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[11px] text-[#103B2B]">
              {onlineUsers.length > 1 ? `${onlineUsers.length} Active` : 'Live'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-stone-600 bg-white px-3 py-1.5 rounded-xl border border-[#E3E7E1] shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#103B2B]" />
            <span>5 November 2026</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-9 h-9 rounded-full bg-white hover:bg-stone-50 border border-[#E3E7E1] flex items-center justify-center text-stone-600 shadow-2xs transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D97706]" />
              )}
            </button>

            <NotificationDropdown
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>

          <button
            onClick={onOpenAuth}
            className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-2xs transition active:scale-95 bg-[#103B2B] hover:bg-[#09251B]"
            title={`Signed in as ${currentUser.full_name} (${currentUser.role})`}
          >
            {initials}
          </button>
        </div>
      </header>
    </>
  );
};
