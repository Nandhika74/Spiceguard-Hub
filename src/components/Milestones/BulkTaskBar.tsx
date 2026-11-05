import React from 'react';
import { TaskStatus } from '../../types';
import { SEED_MEMBERS } from '../../lib/constants';
import { CheckSquare, UserCheck, CheckCircle2, X } from 'lucide-react';

interface BulkTaskBarProps {
  selectedTaskIds: string[];
  onClearSelection: () => void;
  onBulkUpdate: (updates: { status?: TaskStatus; assignee_id?: string }) => void;
}

export const BulkTaskBar: React.FC<BulkTaskBarProps> = ({
  selectedTaskIds,
  onClearSelection,
  onBulkUpdate,
}) => {
  if (selectedTaskIds.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 animate-slideUp max-w-[95vw] sm:max-w-xl">
      <div className="flex items-center gap-2 pr-3 border-r border-stone-700 text-xs font-bold text-amber-400 shrink-0">
        <CheckSquare className="w-4 h-4" />
        <span>{selectedTaskIds.length} Selected</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        {/* Status Dropdown */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              onBulkUpdate({ status: e.target.value as TaskStatus });
              e.target.value = '';
            }
          }}
          className="bg-stone-800 text-stone-200 border border-stone-600 rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>
            Set Status...
          </option>
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Blocked">Blocked</option>
          <option value="Done">Mark Done</option>
        </select>

        {/* Reassign Dropdown */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              onBulkUpdate({ assignee_id: e.target.value });
              e.target.value = '';
            }
          }}
          className="bg-stone-800 text-stone-200 border border-stone-600 rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>
            Reassign To...
          </option>
          {SEED_MEMBERS.map((m) => (
            <option key={m.id} value={m.email}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onClearSelection}
        className="ml-auto text-stone-400 hover:text-white p-1 rounded-lg transition"
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
