import React, { useState } from 'react';
import { Task } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { timeAgo, formatDateTime } from '../../lib/dateUtils';
import { MessageSquare, Send, X, User } from 'lucide-react';

interface TaskCommentsModalProps {
  task: Task | null;
  onClose: () => void;
}

export const TaskCommentsModal: React.FC<TaskCommentsModalProps> = ({ task, onClose }) => {
  const { addTaskComment, currentUser } = useRealtimeStore();
  const [commentText, setCommentText] = useState('');

  if (!task) return null;

  const comments = task.comments || [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addTaskComment(task.id, commentText);
    setCommentText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn">
        {/* Header */}
        <div className="bg-emerald-950 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 text-emerald-200 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Task Comments
              </h3>
              <p className="text-xs font-semibold text-white truncate max-w-[240px]">
                {task.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {comments.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
              No comments yet. Start the conversation with your team!
            </div>
          ) : (
            comments.map((comm) => (
              <div key={comm.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: comm.user_color || '#14532D' }}
                    >
                      {comm.user_name.charAt(0)}
                    </span>
                    <span className="text-xs font-bold text-stone-900">{comm.user_name}</span>
                    {comm.user_role && (
                      <span className="text-[10px] text-stone-500 bg-stone-200/70 px-1.5 py-0.2 rounded">
                        {comm.user_role.split(' ')[0]}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400">
                    {timeAgo(comm.created_at)}
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed pl-7 whitespace-pre-wrap">
                  {comm.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={`Comment as ${currentUser.full_name}...`}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="p-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-40 text-white transition active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
