import React from 'react';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { timeAgo } from '../lib/dateUtils';
import { Bell, CheckCheck, Trash2, Calendar, MessageSquare, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, clearAllNotifications } =
    useRealtimeStore();

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'new_comment':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'new_meeting':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'milestone_rescheduled':
      case 'task_due_soon':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'task_overdue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-stone-500" />;
    }
  };

  return (
    <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-stone-200 z-50 overflow-hidden animate-scaleIn">
      {/* Header */}
      <div className="bg-stone-50 px-4 py-3 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-900" />
          <h3 className="text-xs font-bold text-stone-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllNotificationsAsRead()}
              title="Mark all as read"
              className="text-stone-500 hover:text-emerald-800 p-1 rounded transition"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => clearAllNotifications()}
              title="Clear all"
              className="text-stone-400 hover:text-red-600 p-1 rounded transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No notifications right now.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationAsRead(notif.id)}
              className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-stone-50 ${
                !notif.read ? 'bg-emerald-50/50' : ''
              }`}
            >
              <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className={`text-xs font-semibold ${!notif.read ? 'text-stone-900' : 'text-stone-600'}`}>
                    {notif.title}
                  </p>
                  <span className="text-[10px] text-stone-400 shrink-0">
                    {timeAgo(notif.created_at)}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  {notif.message}
                </p>
              </div>
              {!notif.read && (
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
