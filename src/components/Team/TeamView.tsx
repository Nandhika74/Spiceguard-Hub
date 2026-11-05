import React, { useState } from 'react';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { SEED_MEMBERS } from '../../lib/constants';
import { Member, MemberRole } from '../../types';
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

const MEMBER_ROLES: MemberRole[] = [
  'Team Lead & ML Developer',
  'ML Engineer',
  'Biotech Researcher',
  'IoT Engineer',
];

export const TeamView: React.FC = () => {
  const { tasks, teamMembers, allowedEmails, addAllowedEmail, removeAllowedEmail, currentUser, updateMemberProfile } =
    useRealtimeStore();

  const [inputEmail, setInputEmail] = useState('');
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<MemberRole>('ML Engineer');
  const [editError, setEditError] = useState<string | null>(null);

  const members = teamMembers.length > 0 ? teamMembers : SEED_MEMBERS;

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
  const memberStats = members.map((member) => {
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
    members.length === 0 ? 0 : totalAssignedTasks / members.length;

  const openEditModal = (member: Member) => {
    setMemberToEdit(member);
    setEditName(member.full_name);
    setEditRole(member.role);
    setEditError(null);
  };

  const saveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;
    const result = updateMemberProfile(memberToEdit.id, {
      full_name: editName,
      role: editRole,
    });
    if (!result.success) {
      setEditError(result.message);
      return;
    }
    setMemberToEdit(null);
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    addAllowedEmail(clean);
    setInputEmail('');
  };

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-6xl mx-auto pt-4">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#103C2B] tracking-tight">
          Team Workspace & Analytics
        </h2>
        <p className="text-xs sm:text-sm text-[#758078] mt-0.5">
          {members.length} active members · Real-time workload and completion tracking
        </p>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Team Members"
          value={members.length}
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
                    className="p-1.5 text-[#758078] hover:text-[#103C2B] rounded-lg hover:bg-[#F6F7F3] transition"
                    onClick={() => openEditModal(member)}
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

      {memberToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveMember} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#103C2B]">Edit team member</h3>
              <button type="button" onClick={() => setMemberToEdit(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {editError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{editError}</p>}
            <label className="block text-xs font-semibold text-stone-700">
              Name
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" required />
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Job title
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as MemberRole)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                {MEMBER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMemberToEdit(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
              <button type="submit" className="rounded-lg bg-[#103B2B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#09251B]">Save changes</button>
            </div>
          </form>
        </div>
      )}

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
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E2E6DF] bg-[#F6F7F3] focus:outline-none focus:ring-2 focus:ring-[#1C6245]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#103C2B] hover:bg-[#1C6245] text-white text-xs font-semibold transition"
          >
            Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-1">
          {allowedEmails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F6F7F3] border border-[#E2E6DF] text-xs text-[#172D25]"
            >
              <span>{email}</span>
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
    </div>
  );
};
