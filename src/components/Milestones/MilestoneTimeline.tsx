import React from 'react';
import { Milestone, Task } from '../../types';
import { formatDate, getDeadlineStatus } from '../../lib/dateUtils';
import { Calendar, CheckCircle2, Clock, AlertCircle, Target, ChevronRight } from 'lucide-react';

interface MilestoneTimelineProps {
  milestones: Milestone[];
  tasks: Task[];
  onOpenMilestone: (milestone: Milestone) => void;
  onOpenTask: (task: Task) => void;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  tasks,
  onOpenMilestone,
  onOpenTask,
}) => {
  // Sort milestones chronologically
  const sortedMilestones = [...milestones]
    .filter((m) => !m.archived)
    .sort((a, b) => (a.planned_date > b.planned_date ? 1 : -1));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Timeline Intro */}
      <div className="p-4 rounded-2xl bg-emerald-950 text-white flex items-center justify-between border border-emerald-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              PoC Chronological Roadmap
            </h3>
            <p className="text-xs text-emerald-200">
              6-Month Gantt Sequence from Lab Baseline to Warehouse Pilot
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-900 text-emerald-200 border border-emerald-800">
          Oct 2026 – Mar 2027
        </span>
      </div>

      {/* Sequential Line */}
      <div className="relative border-l-2 border-emerald-800/40 ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-8">
        {sortedMilestones.map((milestone, idx) => {
          const milestoneTasks = tasks.filter((t) => t.milestone_id === milestone.id);
          const isDone = milestone.status === 'Done';
          const isRescheduled =
            milestone.original_planned_date &&
            milestone.original_planned_date !== milestone.planned_date;

          return (
            <div key={milestone.id} className="relative group">
              {/* Timeline Node Icon */}
              <div
                className={`absolute -left-[35px] sm:-left-[43px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition shadow-sm ${
                  isDone
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : milestone.status === 'In Progress'
                    ? 'bg-amber-500 border-amber-400 text-emerald-950'
                    : 'bg-white border-emerald-800 text-emerald-900'
                }`}
              >
                {idx + 1}
              </div>

              {/* Card */}
              <div className="rounded-2xl bg-white border border-stone-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                        {milestone.phase_label || `Phase ${idx + 1}`}
                      </span>
                      {isRescheduled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          Rescheduled (Target: {formatDate(milestone.planned_date)})
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          milestone.status === 'Done'
                            ? 'bg-emerald-100 text-emerald-800'
                            : milestone.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {milestone.status}
                      </span>
                    </div>

                    <h4
                      onClick={() => onOpenMilestone(milestone)}
                      className="text-sm font-bold text-stone-900 hover:text-emerald-900 cursor-pointer"
                    >
                      {milestone.title}
                    </h4>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs font-bold text-stone-900 flex items-center sm:justify-end gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                      {formatDate(milestone.planned_date)}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      Original: {formatDate(milestone.original_planned_date)}
                    </p>
                  </div>
                </div>

                {milestone.description && (
                  <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">
                    {milestone.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[11px] text-stone-500 font-medium">Phase Progress</span>
                    <span className="text-xs font-bold text-emerald-800">
                      {milestone.progress_percentage}% ({milestoneTasks.filter((t) => t.status === 'Done').length}/
                      {milestoneTasks.length} tasks)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                      style={{ width: `${milestone.progress_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Subtasks timeline bullets */}
                {milestoneTasks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Milestone Deliverables:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {milestoneTasks.map((task) => {
                        const isTaskDone = task.status === 'Done';
                        const { isOverdue } = getDeadlineStatus(task.deadline, isTaskDone);

                        return (
                          <div
                            key={task.id}
                            onClick={() => onOpenTask(task)}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                              isTaskDone
                                ? 'bg-stone-50 border-stone-200 text-stone-500'
                                : isOverdue
                                ? 'bg-red-50/50 border-red-200 text-red-900'
                                : 'bg-white border-stone-200 hover:border-emerald-400 text-stone-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isTaskDone
                                    ? 'bg-emerald-600'
                                    : isOverdue
                                    ? 'bg-red-600'
                                    : 'bg-amber-500'
                                }`}
                              />
                              <span className={`truncate text-xs ${isTaskDone ? 'line-through' : 'font-medium'}`}>
                                {task.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-400 shrink-0 font-medium">
                              {formatDate(task.deadline)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
