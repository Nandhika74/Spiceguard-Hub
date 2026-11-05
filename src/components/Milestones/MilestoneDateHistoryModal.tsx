import React from 'react';
import { Milestone } from '../../types';
import { formatDate, timeAgo } from '../../lib/dateUtils';
import { History, Calendar, X, AlertCircle } from 'lucide-react';

interface MilestoneDateHistoryModalProps {
  milestone: Milestone | null;
  onClose: () => void;
}

export const MilestoneDateHistoryModal: React.FC<MilestoneDateHistoryModalProps> = ({
  milestone,
  onClose,
}) => {
  if (!milestone) return null;

  const history = milestone.date_history || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-scaleIn">
        <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Date Revision History
              </h3>
              <p className="text-xs font-semibold text-white truncate max-w-[240px]">
                {milestone.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current vs Original Summary */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] text-amber-800 font-bold uppercase">Original Planned</p>
              <p className="text-xs font-bold text-stone-900">
                {formatDate(milestone.original_planned_date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-amber-800 font-bold uppercase">Current Target</p>
              <p className="text-xs font-bold text-amber-900">
                {formatDate(milestone.planned_date)}
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-400 flex flex-col items-center gap-1">
                <Calendar className="w-6 h-6 text-stone-300" />
                <span>This milestone has not been rescheduled.</span>
                <span className="text-[10px] text-stone-400">
                  Target date remains on original schedule.
                </span>
              </div>
            ) : (
              history.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">
                      {formatDate(item.old_date)} →{' '}
                      <span className="text-amber-700">{formatDate(item.new_date)}</span>
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {timeAgo(item.changed_at)}
                    </span>
                  </div>

                  {item.reason && (
                    <div className="text-stone-600 bg-white p-2 rounded-lg border border-stone-150 text-[11px] leading-relaxed">
                      <strong>Reason:</strong> {item.reason}
                    </div>
                  )}

                  <p className="text-[10px] text-stone-400">
                    Changed by <span className="font-semibold text-stone-700">{item.changed_by}</span>
                  </p>
                </div>
              ))
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
