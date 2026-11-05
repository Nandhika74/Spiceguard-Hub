import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-2 text-xs md:text-sm font-medium shadow-md flex items-center justify-between animate-fadeIn">
      <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
        <span>
          <strong>Offline Mode:</strong> You are currently offline. Changes are saved locally and will sync once reconnected.
        </span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 inline-flex items-center gap-1 bg-amber-700 hover:bg-amber-800 text-xs px-2.5 py-1 rounded transition"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
};
