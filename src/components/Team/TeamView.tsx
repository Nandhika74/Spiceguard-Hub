import React, { useState } from 'react';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { SEED_MEMBERS } from '../../lib/constants';
import { getDeadlineStatus } from '../../lib/dateUtils';
import { StatCard } from '../ui/StatCard';
import { ChartCard } from '../ui/ChartCard';
import { DonutChart } from '../ui/DonutChart';
import { HorizontalBarChart } from '../ui/HorizontalBarChart';
import {
  Users,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pencil,
  ShieldCheck,
  X,
} from 'lucide-react';

export const TeamView: React.FC = () => {
  const {
    tasks,
    allowedEmails,
    addAllowedEmail,
    generateActivationCodeForInvite,
    removeAllowedEmail,
    currentUser,
    teamMembers,
    updateMemberProfile,
  } = useRealtimeStore();

  const [inputEmail, setInputEmail] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#14532D');
  const [editStatus, setEditStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const membersList = teamMembers.length > 0 ? teamMembers : SEED_MEMBERS;

  // Reconciled task status counts (mutually exclusive)
  const totalAssignedTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'Done').length;
  const overdueCount = tasks.filter(
    (t) => t.status !== 'Done' && getDeadlineStatus(t.deadline, false).isOverdue
  ).length;
  const inProgressCount = tasks.filter(
    (t) =>
      t.status === 'In Progress' && !getDeadlineStatus(t.deadline, false).isOverdue
  ).length;
  const pendingCount = Math.max(
    0,
    totalAssignedTasks - completedCount - overdueCount - inProgressCount
  );

  // Per-member metrics
  const memberStats = membersList.map((member) => {
    const memberTasks = tasks.filter(
      (t) =>
        t.assignee_id?.toLowerCase() === member.email.toLowerCase() ||
        t.assignee_name?.toLowerCase() === member.full_name.toLowerCase()
    );
    const done = memberTasks.filter((t) => t.status === 'Done').length;
    const overdue = memberTasks.filter(
      (t) => t.status !== 'Done' && getDeadlineStatus(t.deadline, false).isOverdue
    ).length;
    const pct =
      memberTasks.length === 0 ? 0 : Math.round((done / memberTasks.length) * 100);

    return {
      member,
      total: memberTasks.length,
      done,
      overdue,
      pct,
    };
  });

  const avgTasksPerMember =
    SEED_MEMBERS.length === 0 ? 0 : totalAssignedTasks / SEED_MEMBERS.length;

  const [inviteStatus, setInviteStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatus(null);
    const clean = inputEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setInviteStatus({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    setIsInviting(true);
    try {
      const res = await addAllowedEmail(clean);
      if (res.success) {
        setInputEmail('');
        setInviteStatus({ type: 'success', text: res.message });
      } else {
        setInviteStatus({ type: 'error', text: res.message });
      }
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-6xl mx-auto pt-4">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#103C2B] tracking-tight">
          Team Workspace & Analytics
        </h2>
        <p className="text-xs sm:text-sm text-[#758078] mt-0.5">
          {SEED_MEMBERS.length} active members · Real-time workload and completion tracking
        </p>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Team Members"
          value={SEED_MEMBERS.length}
          subtext="Core PoC squad"
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="Assigned Tasks"
          value={totalAssignedTasks}
          subtext="Across all milestones"
          icon={ListTodo}
        />
        <StatCard
          label="Completed"
          value={completedCount}
          subtext={`${
            totalAssignedTasks === 0
              ? 0
              : Math.round((completedCount / totalAssignedTasks) * 100)
          }% overall`}
          icon={CheckCircle2}
          tone="primary"
        />
        <StatCard
          label="In Progress"
          value={inProgressCount}
          subtext="Active workstreams"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          subtext={overdueCount === 0 ? 'All on track' : 'Needs attention'}
          icon={AlertTriangle}
          tone={overdueCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Visual Analytics Section (A, B, C, D) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* A. Task Distribution by Member */}
        <ChartCard
          title="Task Distribution by Member"
          subtitle="Total tasks assigned per team member"
          isEmpty={totalAssignedTasks === 0}
        >
          <HorizontalBarChart
            items={memberStats.map((s) => ({
              label: s.member.full_name,
              value: s.total,
              suffix: ' tasks',
              color: '#1C6245',
            }))}
          />
        </ChartCard>

        {/* B. Task Status Distribution */}
        <ChartCard
          title="Task Status Distribution"
          subtitle="Completed, in-progress, pending, and overdue breakdown"
          isEmpty={totalAssignedTasks === 0}
        >
          <DonutChart
            centerLabel="Tasks"
            segments={[
              { label: 'Completed', value: completedCount, color: '#1C6245' },
              { label: 'In Progress', value: inProgressCount, color: '#E99132' },
              { label: 'Pending', value: pendingCount, color: '#DCE8DA' },
              { label: 'Overdue', value: overdueCount, color: '#D9534F' },
            ]}
          />
        </ChartCard>

        {/* C. Individual Completion Comparison */}
        <ChartCard
          title="Individual Completion Comparison"
          subtitle="Percentage of assigned tasks completed"
          isEmpty={totalAssignedTasks === 0}
        >
          <HorizontalBarChart
            items={memberStats.map((s) => ({
              label: s.member.full_name,
              value: s.pct,
              maxValue: 100,
              suffix: '%',
              color: '#103C2B',
            }))}
          />
        </ChartCard>

        {/* D. Workload Distribution */}
        <ChartCard
          title="Workload Distribution"
          subtitle="Share of total team tasks & high-workload alerts"
          isEmpty={totalAssignedTasks === 0}
        >
          <HorizontalBarChart
            items={memberStats.map((s) => {
              const sharePct =
                totalAssignedTasks === 0
                  ? 0
                  : Math.round((s.total / totalAssignedTasks) * 100);
              const isHigh = s.total > avgTasksPerMember + 1 || sharePct >= 40;
              return {
                label: s.member.full_name,
                value: sharePct,
                maxValue: 100,
                suffix: '% share',
                color: isHigh ? '#E99132' : '#1C6245',
                badge: isHigh ? 'High Workload' : undefined,
              };
            })}
          />
        </ChartCard>
      </div>

      {/* Individual Member Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#103C2B] uppercase tracking-wider">
          Team Members
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memberStats.map(({ member, total, done, overdue, pct }) => {
            const isYou =
              member.email.toLowerCase() === currentUser.email.toLowerCase();
            const initials = member.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={member.id}
                className="rounded-xl bg-white border border-[#E2E6DF] p-5 shadow-2xs flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-full text-white font-bold text-sm flex items-center justify-center shrink-0"
                      style={{ backgroundColor: member.avatar_color || '#103C2B' }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[#172D25] truncate">
                          {member.full_name}
                        </h4>
                        {isYou && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E99132]/15 text-[#E99132]">
                            YOU
                          </span>
                        )}
                        {member.is_team_lead && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#103C2B] text-white">
                            TEAM LEAD
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#758078] mt-0.5">{member.role}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingMemberId(member.id);
                      setEditName(member.full_name);
                      setEditColor(member.avatar_color);
                      setEditStatus(null);
                    }}
                    className="p-1.5 text-[#758078] hover:text-[#103C2B] rounded-lg hover:bg-[#F6F7F3] transition"
                    title="Edit member"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-stone-100 text-center">
                  <div>
                    <span className="text-base font-bold text-[#172D25] block">
                      {total}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[#758078]">
                      Assigned
                    </span>
                  </div>
                  <div>
                    <span className="text-base font-bold text-[#1C6245] block">
                      {done}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[#758078]">
                      Completed
                    </span>
                  </div>
                  <div>
                    <span className="text-base font-bold text-[#103C2B] block">
                      {pct}%
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[#758078]">
                      Rate
                    </span>
                  </div>
                  <div>
                    <span
                      className={`text-base font-bold block ${
                        overdue > 0 ? 'text-[#D9534F]' : 'text-[#172D25]'
                      }`}
                    >
                      {overdue}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[#758078]">
                      Overdue
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-[#F6F7F3] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1C6245] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite-Only Allowlist Management */}
      <div className="rounded-xl bg-white border border-[#E2E6DF] p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#103C2B]" />
          <h3 className="text-sm font-bold text-[#172D25]">
            Workspace Access Allowlist
          </h3>
        </div>

        <form onSubmit={handleAddEmail} className="flex items-center gap-2">
          <input
            type="email"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            placeholder="Add team member email..."
            disabled={isInviting}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E2E6DF] bg-[#F6F7F3] focus:outline-none focus:ring-2 focus:ring-[#1C6245] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isInviting}
            className="px-4 py-2 rounded-lg bg-[#103C2B] hover:bg-[#1C6245] disabled:opacity-60 text-white text-xs font-semibold transition"
          >
            {isInviting ? 'Inviting...' : 'Add'}
          </button>
        </form>

        {inviteStatus && (
          <p
            className={`text-xs font-medium ${
              inviteStatus.type === 'success' ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {inviteStatus.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {allowedEmails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F6F7F3] border border-[#E2E6DF] text-xs text-[#172D25]"
            >
              <span>{email}</span>
              {currentUser.is_team_lead && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await generateActivationCodeForInvite(email);
                    setInviteStatus({
                      type: res.success ? 'success' : 'error',
                      text: res.message,
                    });
                  }}
                  className="text-[10px] font-semibold text-[#164E33] hover:underline px-1"
                  title="Generate one-time activation code"
                >
                  Generate Code
                </button>
              )}
              <button
                onClick={() => removeAllowedEmail(email)}
                className="text-[#758078] hover:text-[#D9534F]"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
      {/* Edit Member Profile Modal */}
      {editingMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#172D25]">Edit Team Member</h3>
              <button
                type="button"
                onClick={() => setEditingMemberId(null)}
                className="text-stone-400 hover:text-stone-700 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingProfile(true);
                setEditStatus(null);
                const res = await updateMemberProfile(editingMemberId, {
                  full_name: editName,
                  avatar_color: editColor,
                });
                setIsSavingProfile(false);
                if (!res.success) {
                  setEditStatus({ type: 'error', msg: res.message });
                } else {
                  setEditStatus({ type: 'success', msg: res.message });
                  setTimeout(() => setEditingMemberId(null), 600);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Avatar Color
                </label>
                <div className="flex items-center gap-2">
                  {['#14532D', '#0F766E', '#B45309', '#1D4ED8', '#7C3AED', '#BE123C'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className={`w-7 h-7 rounded-full transition ${
                        editColor === color ? 'ring-2 ring-offset-2 ring-emerald-800 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {editStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs border ${
                    editStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {editStatus.msg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMemberId(null)}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-2 rounded-xl bg-[#103B2B] hover:bg-[#09251B] disabled:opacity-60 text-white text-xs font-semibold"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
