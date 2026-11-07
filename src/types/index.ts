export type MemberRole =
  | 'Team Lead & ML Developer'
  | 'ML Engineer'
  | 'Biotech Researcher'
  | 'IoT Engineer';

export interface Member {
  id: string;
  email: string;
  full_name: string;
  role: MemberRole;
  avatar_color: string;
  is_team_lead: boolean;
}

export interface Profile {
  id: string; // auth.users UUID
  email: string;
  full_name: string;
  role: string;
  avatar_color: string;
  is_team_lead: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string; // UUID
  name: string;
  slug: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string; // UUID
  workspace_id: string;
  user_id?: string | null;
  invited_email: string;
  invited_role: string;
  invited_is_team_lead: boolean;
  status: 'invited' | 'active';
  created_at: string;
}

export type MilestoneStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Done';

export interface MilestoneDateHistoryItem {
  id: string;
  workspace_id?: string;
  milestone_id: string;
  old_date: string;
  new_date: string;
  reason?: string;
  changed_by: string;
  changed_by_id?: string | null;
  changed_at: string;
}

export interface Milestone {
  id: string;
  workspace_id?: string;
  title: string;
  description: string;
  planned_date: string; // YYYY-MM-DD
  original_planned_date: string; // YYYY-MM-DD
  actual_completion_date?: string | null;
  status: MilestoneStatus;
  progress_percentage: number; // 0 - 100
  support_required?: string;
  notes?: string;
  phase_label?: string; // e.g. "Month 1"
  sort_order: number;
  archived: boolean;
  created_by?: string;
  created_by_id?: string | null;
  updated_by?: string;
  updated_by_id?: string | null;
  created_at: string;
  updated_at: string;
  date_history?: MilestoneDateHistoryItem[];
}

export type TaskStatus = 'Todo' | 'In Progress' | 'Blocked' | 'Done';
export type TaskPriority = 'Low' | 'Med' | 'High';

export interface TaskComment {
  id: string;
  workspace_id?: string;
  task_id: string;
  user_id: string;
  user_uuid?: string | null;
  user_name: string;
  user_role?: string;
  user_color?: string;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id?: string;
  milestone_id: string;
  title: string;
  assignee_id?: string; // member email or id
  assignee_name?: string;
  deadline?: string; // YYYY-MM-DD
  status: TaskStatus;
  priority: TaskPriority;
  notes?: string;
  completed_at?: string | null;
  completion_date?: string | null; // e.g., actual visit or execution date like "2026-11-06"
  completion_details?: string | null; // notes, findings, observations
  completed_by_name?: string | null;
  completion_document_id?: string | null; // linked to documents section
  completion_document_title?: string | null;
  sort_order: number;
  created_by?: string;
  created_by_id?: string | null;
  updated_by?: string;
  updated_by_id?: string | null;
  created_at: string;
  updated_at: string;
  comments?: TaskComment[];
}

export type MeetingType =
  | 'Internal review'
  | 'Mentor meeting'
  | 'Plant Lipids'
  | 'Other';

export interface MeetingActionItem {
  id: string;
  workspace_id?: string;
  meeting_id: string;
  text: string;
  assignee?: string;
  due_date?: string;
  converted_task_id?: string | null;
  status: 'pending' | 'converted' | 'done';
  created_at: string;
}

export interface Meeting {
  id: string;
  workspace_id?: string;
  title: string;
  meeting_date: string; // ISO string
  type: MeetingType;
  attendees: string[]; // member names
  guest_attendees?: string;
  agenda?: string;
  notes?: string;
  key_decisions?: string;
  inferences_learnings?: string;
  attachment_urls?: Array<{ name: string; url: string; size?: number }>;
  created_by: string; // email
  created_by_id?: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  action_items?: MeetingActionItem[];
}

export type DocumentCategory =
  | 'Model/ML'
  | 'Hardware/Sensors'
  | 'Biotech'
  | 'Plant Lipids data'
  | 'Pitch/Reports'
  | 'Other';

export interface DocumentFileAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface DocumentItem {
  id: string;
  workspace_id?: string;
  title: string;
  description?: string;
  category: DocumentCategory;
  tags: string[];
  file_url: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  attachments?: DocumentFileAttachment[];
  is_external_link: boolean;
  milestone_id?: string;
  uploaded_by: string; // email
  uploaded_by_id?: string | null;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_due_soon'
  | 'task_overdue'
  | 'new_comment'
  | 'new_meeting'
  | 'milestone_rescheduled';

export interface NotificationItem {
  id: string;
  workspace_id?: string;
  user_id?: string | null;
  user_email: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface ActivityLogItem {
  id: string;
  workspace_id?: string;
  actor_id?: string | null;
  actor_name: string;
  action: string;
  entity_type: 'milestone' | 'task' | 'meeting' | 'document' | 'comment' | 'user';
  entity_id?: string;
  details: string;
  created_at: string;
}

export type ActiveTab = 'dashboard' | 'milestones' | 'meetings' | 'documents' | 'team';
