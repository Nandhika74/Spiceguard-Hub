import React, { useEffect, useState } from 'react';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export const UndoToast: React.FC = () => {
  const { deletedTaskUndoStack, undoDeleteTask } = useRealtimeStore();
  const [secondsRemaining, setSecondsRemaining] = useState(10);

  useEffect(() => {
    if (!deletedTaskUndoStack) {
      setSecondsRemaining(10);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - deletedTaskUndoStack.timestamp) / 1000);
      const remaining = Math.max(10 - elapsed, 0);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [deletedTaskUndoStack]);

  if (!deletedTaskUndoStack || secondsRemaining <= 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 bg-stone-900 text-white rounded-xl shadow-2xl p-4 flex items-center justify-between border border-stone-700 animate-slideUp">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-stone-400">Task deleted ({secondsRemaining}s left to undo)</p>
          <p className="text-sm font-semibold truncate text-white">
            "{deletedTaskUndoStack.task.title}"
          </p>
        </div>
      </div>
      <button
        onClick={() => undoDeleteTask()}
        className="ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Undo
      </button>
    </div>
  );
};
