import {
  Member,
  MemberRole,
  Milestone,
  MilestoneDateHistoryItem,
  Task,
  TaskComment,
  Meeting,
  MeetingActionItem,
  DocumentItem,
  NotificationItem,
  ActivityLogItem,
  TaskStatus,
  TaskPriority,
  Workspace,
} from '../types';
import {
  SEED_MEMBERS,
  INITIAL_MILESTONES,
  INITIAL_TASKS,
  INITIAL_MEETINGS,
  INITIAL_DOCUMENTS,
  INITIAL_ACTIVITY_LOG,
} from './constants';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

type Listener = () => void;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'local';

interface StoreState {
  authStatus: AuthStatus;
  authError: string | null;
  dbError: string | null;
  workspaceId: string | null;
  workspace: Workspace | null;
  teamMembers: Member[];
  currentUser: Member;
  allowedEmails: string[];
  milestones: Milestone[];
  tasks: Task[];
  meetings: Meeting[];
  documents: DocumentItem[];
  notifications: NotificationItem[];
  activityLog: ActivityLogItem[];
  deletedTaskUndoStack: { task: Task; timeoutId: any; timestamp: number } | null;
  isRealtimeConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

const STORAGE_KEY_PREFIX = 'spiceguard_hub_v3_';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn('Storage read error:', e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write error:', e);
  }
}

class RealtimeStore {
  private state: StoreState;
  private listeners: Set<Listener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseSubscription: any = null;
  private authSubscription: { unsubscribe: () => void } | null = null;

  constructor() {
    const supabaseReady = isSupabaseConfigured();
    const defaultUser = SEED_MEMBERS.find((m) => m.email.toLowerCase() === 'nandhikas3@gmail.com') || SEED_MEMBERS[2];

    if (supabaseReady) {
      // Supabase mode: do not load localStorage or BroadcastChannel
      this.state = {
        authStatus: 'loading',
        authError: null,
        dbError: null,
        workspaceId: null,
        workspace: null,
        teamMembers: [],
        currentUser: defaultUser,
        allowedEmails: [],
        milestones: [],
        tasks: [],
        meetings: [],
        documents: [],
        notifications: [],
        activityLog: [],
        deletedTaskUndoStack: null,
        isRealtimeConnected: false,
        isSyncing: true,
        lastSyncTime: null,
      };
      this.initSupabaseRealtime();
    } else {
      // Local development fallback mode
      const savedUser = loadFromStorage<Member>('current_user', defaultUser);
      const canonicalUser = SEED_MEMBERS.find((m) => m.email.toLowerCase() === savedUser?.email?.toLowerCase()) || defaultUser;
      const allowed = loadFromStorage<string[]>('allowed_emails', [
        'nandhikas3@gmail.com',
        'nithyasree2410841@ssn.edu.in',
        'sivakumarans.bbt24@rathinam.in',
        'abhijithsriram2410202@ssn.edu.in',
        'nahypin17@gmail.com',
        'roopavathik@ssnifound.in',
      ]);

      this.state = {
        authStatus: 'local',
        authError: null,
        dbError: null,
        workspaceId: null,
        workspace: null,
        teamMembers: SEED_MEMBERS,
        currentUser: canonicalUser,
        allowedEmails: allowed,
        milestones: loadFromStorage<Milestone[]>('milestones', INITIAL_MILESTONES),
        tasks: loadFromStorage<Task[]>('tasks', INITIAL_TASKS),
        meetings: loadFromStorage<Meeting[]>('meetings', INITIAL_MEETINGS),
        documents: loadFromStorage<DocumentItem[]>('documents', INITIAL_DOCUMENTS),
        notifications: loadFromStorage<NotificationItem[]>('notifications', [
          {
            id: 'notif-welcome',
            user_email: canonicalUser.email,
            type: 'task_assigned',
            title: 'Welcome to SpiceGuard Hub',
            message: '6-Month Proof of Concept with Plant Lipids is initialized.',
            read: false,
            created_at: new Date().toISOString(),
          },
        ]),
        activityLog: loadFromStorage<ActivityLogItem[]>('activity_log', INITIAL_ACTIVITY_LOG as ActivityLogItem[]),
        deletedTaskUndoStack: null,
        isRealtimeConnected: true,
        isSyncing: false,
        lastSyncTime: new Date(),
      };

      this.recalculateAllMilestoneProgress();

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('spiceguard_hub_sync');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'STATE_UPDATE') {
              this.handleRemoteStateUpdate(event.data.payload);
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel error:', e);
        }

        window.addEventListener('storage', (e) => {
          if (e.key && e.key.startsWith(STORAGE_KEY_PREFIX)) {
            this.reloadFromStorage();
          }
        });
      }
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.state = {
      ...this.state,
      tasks: [...this.state.tasks],
      milestones: [...this.state.milestones],
      meetings: [...this.state.meetings],
      documents: [...this.state.documents],
      notifications: [...this.state.notifications],
      activityLog: [...this.state.activityLog],
    };

    // Only persist to localStorage & BroadcastChannel when Supabase is NOT configured
    if (!isSupabaseConfigured()) {
      saveToStorage('milestones', this.state.milestones);
      saveToStorage('tasks', this.state.tasks);
      saveToStorage('meetings', this.state.meetings);
      saveToStorage('documents', this.state.documents);
      saveToStorage('notifications', this.state.notifications);
      saveToStorage('activity_log', this.state.activityLog);
      saveToStorage('allowed_emails', this.state.allowedEmails);
      saveToStorage('current_user', this.state.currentUser);

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
        type: 'STATE_UPDATE',
        payload: {
          milestones: this.state.milestones,
          tasks: this.state.tasks,
          meetings: this.state.meetings,
          documents: this.state.documents,
          notifications: this.state.notifications,
          activityLog: this.state.activityLog,
        },
      });
      }
    }

    this.listeners.forEach((listener) => listener());
  }

  private handleRemoteStateUpdate(payload: Partial<StoreState>): void {
    if (payload.milestones) this.state.milestones = payload.milestones;
    if (payload.tasks) this.state.tasks = payload.tasks;
    if (payload.meetings) this.state.meetings = payload.meetings;
    if (payload.documents) this.state.documents = payload.documents;
    if (payload.notifications) this.state.notifications = payload.notifications;
    if (payload.activityLog) this.state.activityLog = payload.activityLog;
    this.state.lastSyncTime = new Date();
    this.listeners.forEach((listener) => listener());
  }

  private reloadFromStorage(): void {
    this.state.milestones = loadFromStorage('milestones', this.state.milestones);
    this.state.tasks = loadFromStorage('tasks', this.state.tasks);
    this.state.meetings = loadFromStorage('meetings', this.state.meetings);
    this.state.documents = loadFromStorage('documents', this.state.documents);
    this.state.notifications = loadFromStorage('notifications', this.state.notifications);
    this.state.activityLog = loadFromStorage('activity_log', this.state.activityLog);
    this.listeners.forEach((listener) => listener());
  }

  public clearDbError(): void {
    this.state.dbError = null;
    this.notify();
  }

  public updateMemberProfile(
    id: string,
    updates: Pick<Member, 'full_name' | 'role'>
  ): { success: boolean; message: string } {
    const existing = this.state.teamMembers.find((member) => member.id === id);
    if (!existing) return { success: false, message: 'Team member not found.' };

    const fullName = updates.full_name.trim();
    const role = updates.role.trim() as MemberRole;
    if (!fullName || !role) {
      return { success: false, message: 'Name and job title are required.' };
    }

    const supabase = getSupabaseClient();
    if (supabase && id !== this.state.currentUser.id) {
      return {
        success: false,
        message: 'You can only edit your own profile.',
      };
    }

    const updated = { ...existing, full_name: fullName, role };
    this.state.teamMembers = this.state.teamMembers.map((member) =>
      member.id === id ? updated : member
    );
    if (this.state.currentUser.id === id) {
      this.state.currentUser = updated;
    }

    if (supabase) {
      void supabase
        .from('profiles')
        .update({ full_name: fullName, role })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            this.handleDbError(error, 'Update team member profile');
            return;
          }
          this.notify();
        });
    }

    this.notify();
    return { success: true, message: 'Team member updated.' };
  }

  private handleDbError(error: any, context: string): void {
    if (!error) return;
    console.error(`Supabase ${context} error:`, error);
    this.state.dbError = `${context}: ${error.message || 'Database operation failed.'}`;
    this.notify();
  }

  public async signInWithPassword(
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured.' };
    }
    this.state.authError = null;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    if (data.user) {
      await this.loadAuthenticatedWorkspace(data.user.id);
      if (this.state.authStatus !== 'authenticated') {
        return {
          success: false,
          message: this.state.authError || 'Unable to load workspace membership.',
        };
      }
    }
    return { success: true, message: 'Signed in successfully.' };
  }

  public async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (this.supabaseSubscription && supabase) {
      await supabase.removeChannel(this.supabaseSubscription);
      this.supabaseSubscription = null;
    }
    this.state.workspaceId = null;
    this.state.workspace = null;
    this.state.teamMembers = [];
    this.state.milestones = [];
    this.state.tasks = [];
    this.state.meetings = [];
    this.state.documents = [];
    this.state.notifications = [];
    this.state.activityLog = [];
    this.state.isRealtimeConnected = false;
    this.state.isSyncing = false;
    this.state.authError = null;
    this.state.dbError = null;
    this.state.authStatus = isSupabaseConfigured() ? 'unauthenticated' : 'local';
    this.notify();

    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  public async initSupabaseRealtime(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.state.authStatus = 'local';
      this.state.teamMembers = SEED_MEMBERS;
      this.state.isRealtimeConnected = true;
      return;
    }

    try {
      this.state.isSyncing = true;
      this.notify();

      if (!this.authSubscription) {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT' || !session?.user) {
            if (this.supabaseSubscription) {
              await supabase.removeChannel(this.supabaseSubscription);
              this.supabaseSubscription = null;
            }
            this.state.workspaceId = null;
            this.state.workspace = null;
            this.state.teamMembers = [];
            this.state.milestones = [];
            this.state.tasks = [];
            this.state.meetings = [];
            this.state.documents = [];
            this.state.notifications = [];
            this.state.activityLog = [];
            this.state.authStatus = 'unauthenticated';
            this.state.isRealtimeConnected = false;
            this.state.isSyncing = false;
            this.notify();
          } else if (
            (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
            session.user
          ) {
            if (this.state.workspaceId === null || this.state.currentUser.id !== session.user.id) {
              await this.loadAuthenticatedWorkspace(session.user.id);
            }
          }
        });
        this.authSubscription = authListener.subscription;
      }

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        this.state.authStatus = 'unauthenticated';
        this.state.isSyncing = false;
        this.notify();
        return;
      }

      await this.loadAuthenticatedWorkspace(sessionData.session.user.id);
    } catch (e: any) {
      console.warn('Supabase connect error:', e);
      this.state.dbError = e?.message || 'Failed to connect to Supabase.';
      this.state.isRealtimeConnected = false;
      this.state.isSyncing = false;
      this.notify();
    }
  }

  private async loadAuthenticatedWorkspace(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    this.state.isSyncing = true;
    this.state.authError = null;
    this.state.dbError = null;
    this.notify();

    // 1. Fetch user profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      this.state.authStatus = 'unauthenticated';
      this.state.authError = 'Profile not found. Contact your workspace administrator.';
      this.state.isSyncing = false;
      this.notify();
      return;
    }

    // 2. Fetch active workspace membership
    const { data: membership, error: memberErr } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (memberErr || !membership) {
      this.state.authStatus = 'unauthenticated';
      this.state.authError = 'You do not have an active workspace membership.';
      this.state.isSyncing = false;
      this.notify();
      return;
    }

    const workspaceId = membership.workspace_id as string;

    // 3. Fetch workspace info & active team members
    const [wsRes, wmRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
    ]);

    const memberIds = (wmRes.data || []).map((r: any) => r.user_id).filter(Boolean);
    let teamMembers: Member[] = [];
    if (memberIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberIds);
      teamMembers = (profilesData || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role as MemberRole,
        avatar_color: p.avatar_color,
        is_team_lead: Boolean(p.is_team_lead),
      }));
    }

    this.state.currentUser = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role as MemberRole,
      avatar_color: profile.avatar_color,
      is_team_lead: Boolean(profile.is_team_lead),
    };
    this.state.workspaceId = workspaceId;
    this.state.workspace = wsRes.data || null;
    this.state.teamMembers = teamMembers;
    this.state.authStatus = 'authenticated';

    // 4. Load all 9 project tables for this workspace
    await this.refreshWorkspaceData(workspaceId);

    // 5. Subscribe to Realtime postgres_changes
    if (this.supabaseSubscription) {
      await supabase.removeChannel(this.supabaseSubscription);
      this.supabaseSubscription = null;
    }

    const filter = `workspace_id=eq.${workspaceId}`;
    this.supabaseSubscription = supabase
      .channel(`spiceguard-ws-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones', filter }, (payload) => {
        this.handleMilestoneRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestone_date_history', filter }, () => {
        this.refreshWorkspaceData(workspaceId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, (payload) => {
        this.handleTaskRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter }, (payload) => {
        this.handleCommentRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter }, (payload) => {
        this.handleMeetingRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_action_items', filter }, () => {
        this.refreshWorkspaceData(workspaceId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter }, (payload) => {
        this.handleDocumentRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter }, (payload) => {
        this.handleNotificationRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log', filter }, (payload) => {
        this.handleActivityRealtime(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        this.handleProfileRealtime(payload);
      })
      .subscribe((status) => {
        this.state.isRealtimeConnected = status === 'SUBSCRIBED';
        this.state.isSyncing = false;
        this.state.lastSyncTime = new Date();
        this.notify();
      });
  }

  public async refreshWorkspaceData(wsId?: string): Promise<void> {
    const supabase = getSupabaseClient();
    const workspaceId = wsId || this.state.workspaceId;
    if (!supabase || !workspaceId) return;

    const [mRes, mhRes, tRes, tcRes, mtgRes, maiRes, dRes, nRes, aRes] = await Promise.all([
      supabase.from('milestones').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
      supabase.from('milestone_date_history').select('*').eq('workspace_id', workspaceId).order('changed_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
      supabase.from('task_comments').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
      supabase.from('meetings').select('*').eq('workspace_id', workspaceId).order('meeting_date', { ascending: false }),
      supabase.from('meeting_action_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
      supabase.from('documents').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
    ]);

    const firstErr =
      mRes.error || mhRes.error || tRes.error || tcRes.error || mtgRes.error || maiRes.error || dRes.error || nRes.error || aRes.error;
    if (firstErr) {
      this.handleDbError(firstErr, 'Load workspace data');
      return;
    }

    const historyByMs = new Map<string, MilestoneDateHistoryItem[]>();
    for (const h of (mhRes.data || []) as MilestoneDateHistoryItem[]) {
      const list = historyByMs.get(h.milestone_id) || [];
      list.push(h);
      historyByMs.set(h.milestone_id, list);
    }

    const commentsByTask = new Map<string, TaskComment[]>();
    for (const c of (tcRes.data || []) as TaskComment[]) {
      const list = commentsByTask.get(c.task_id) || [];
      list.push(c);
      commentsByTask.set(c.task_id, list);
    }

    const actionsByMeeting = new Map<string, MeetingActionItem[]>();
    for (const ai of (maiRes.data || []) as MeetingActionItem[]) {
      const list = actionsByMeeting.get(ai.meeting_id) || [];
      list.push(ai);
      actionsByMeeting.set(ai.meeting_id, list);
    }

    this.state.milestones = (mRes.data || []).map((m: any) => ({
      ...m,
      date_history: historyByMs.get(m.id) || [],
    }));
    this.state.tasks = (tRes.data || []).map((t: any) => ({
      ...t,
      comments: commentsByTask.get(t.id) || [],
    }));
    this.state.meetings = (mtgRes.data || []).map((mt: any) => ({
      ...mt,
      action_items: actionsByMeeting.get(mt.id) || [],
    }));
    this.state.documents = (dRes.data || []) as DocumentItem[];
    this.state.notifications = (nRes.data || []) as NotificationItem[];
    this.state.activityLog = (aRes.data || []) as ActivityLogItem[];
    this.state.lastSyncTime = new Date();
    this.notify();
  }

  private handleCommentRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      const c = payload.new as TaskComment;
      this.state.tasks = this.state.tasks.map((t) => {
        if (t.id !== c.task_id) return t;
        const existing = t.comments || [];
        if (existing.some((x) => x.id === c.id)) return t;
        return { ...t, comments: [...existing, c] };
      });
      this.notify();
    }
  }

  private handleNotificationRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      const n = payload.new as NotificationItem;
      if (!this.state.notifications.some((x) => x.id === n.id)) {
        this.state.notifications = [n, ...this.state.notifications];
        this.notify();
      }
    } else if (payload.eventType === 'UPDATE') {
      const n = payload.new as NotificationItem;
      this.state.notifications = this.state.notifications.map((x) =>
        x.id === n.id ? { ...x, ...n } : x
      );
      this.notify();
    }
  }

  private handleMilestoneRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      if (!this.state.milestones.some((m) => m.id === payload.new.id)) {
        this.state.milestones = [...this.state.milestones, payload.new];
      }
    } else if (payload.eventType === 'UPDATE') {
      this.state.milestones = this.state.milestones.map((m) =>
        m.id === payload.new.id ? { ...m, ...payload.new } : m
      );
    } else if (payload.eventType === 'DELETE') {
      this.state.milestones = this.state.milestones.filter((m) => m.id !== payload.old.id);
    }
    this.notify();
  }

  private handleTaskRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      if (!this.state.tasks.some((t) => t.id === payload.new.id)) {
        this.state.tasks = [...this.state.tasks, payload.new];
        this.recalculateMilestoneProgress(payload.new.milestone_id);
      }
    } else if (payload.eventType === 'UPDATE') {
      this.state.tasks = this.state.tasks.map((t) =>
        t.id === payload.new.id ? { ...t, ...payload.new } : t
      );
      this.recalculateMilestoneProgress(payload.new.milestone_id);
    } else if (payload.eventType === 'DELETE') {
      this.state.tasks = this.state.tasks.filter((t) => t.id !== payload.old.id);
      if (payload.old.milestone_id) {
        this.recalculateMilestoneProgress(payload.old.milestone_id);
      }
    }
    this.notify();
  }

  private handleMeetingRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      this.state.meetings = [payload.new, ...this.state.meetings.filter((m) => m.id !== payload.new.id)];
    } else if (payload.eventType === 'UPDATE') {
      this.state.meetings = this.state.meetings.map((m) =>
        m.id === payload.new.id ? { ...m, ...payload.new } : m
      );
    } else if (payload.eventType === 'DELETE') {
      this.state.meetings = this.state.meetings.filter((m) => m.id !== payload.old.id);
    }
    this.notify();
  }

  private handleDocumentRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      this.state.documents = [payload.new, ...this.state.documents.filter((d) => d.id !== payload.new.id)];
    } else if (payload.eventType === 'UPDATE') {
      this.state.documents = this.state.documents.map((d) =>
        d.id === payload.new.id ? { ...d, ...payload.new } : d
      );
    } else if (payload.eventType === 'DELETE') {
      this.state.documents = this.state.documents.filter((d) => d.id !== payload.old.id);
    }
    this.notify();
  }

  private handleActivityRealtime(payload: any): void {
    if (payload.eventType === 'INSERT') {
      this.state.activityLog = [payload.new, ...this.state.activityLog.filter((a) => a.id !== payload.new.id)].slice(0, 100);
      this.notify();
    }
  }

  private handleProfileRealtime(payload: any): void {
    if (payload.eventType === 'DELETE') return;

    const profile = payload.new as Partial<Member> & { id: string };
    const updatedMember: Member = {
      ...(this.state.teamMembers.find((member) => member.id === profile.id) || SEED_MEMBERS.find((member) => member.id === profile.id) || this.state.currentUser),
      ...profile,
      role: profile.role as MemberRole,
      is_team_lead: Boolean(profile.is_team_lead),
    };

    this.state.teamMembers = this.state.teamMembers.map((member) =>
      member.id === updatedMember.id ? updatedMember : member
    );
    if (this.state.currentUser.id === updatedMember.id) {
      this.state.currentUser = updatedMember;
    }
    this.notify();
  }

  // --- GETTERS ---
  public getState(): StoreState {
    return this.state;
  }

  public getCurrentUser(): Member {
    return this.state.currentUser;
  }

  public isCurrentUserTeamLead(): boolean {
    return this.state.currentUser.is_team_lead;
  }

  public getAllowedEmails(): string[] {
    return this.state.allowedEmails;
  }

  public isEmailAllowed(email: string): boolean {
    const clean = email.trim().toLowerCase();
    return this.state.allowedEmails.some((e) => e.toLowerCase() === clean);
  }

  // --- AUTH & USER SWITCHING ---
  public setCurrentUser(member: Member): void {
    const canonical = SEED_MEMBERS.find((m) => m.email.toLowerCase() === member.email.toLowerCase()) || member;
    this.state.currentUser = canonical;
    saveToStorage('current_user', canonical);
    this.logActivity('LOGIN', 'user', canonical.id, `${canonical.full_name} switched active session.`);
    this.notify();
  }

  public addAllowedEmail(email: string): void {
    const clean = email.trim().toLowerCase();
    if (!this.state.allowedEmails.includes(clean)) {
      this.state.allowedEmails = [...this.state.allowedEmails, clean];
      this.logActivity('ALLOWLIST_ADD', 'user', clean, `Added ${clean} to allowed emails.`);
      this.notify();
    }
  }

  public removeAllowedEmail(email: string): void {
    const clean = email.trim().toLowerCase();
    this.state.allowedEmails = this.state.allowedEmails.filter((e) => e.toLowerCase() !== clean);
    this.notify();
  }

  public loginWithEmail(email: string): { success: boolean; message: string; user?: Member } {
    const clean = email.trim().toLowerCase();
    if (!this.isEmailAllowed(clean)) {
      return {
        success: false,
        message: `Access Denied: ${email} is not in the SpiceGuard allowlist. Only the 4 authorized members may log in.`,
      };
    }

    const matched = SEED_MEMBERS.find((m) => m.email.toLowerCase() === clean);
    const user: Member = matched || {
      id: 'mem-' + Math.random().toString(36).substring(2, 9),
      email: clean,
      full_name: clean.split('@')[0].replace(/[._]/g, ' '),
      role: 'ML Engineer',
      avatar_color: '#2E7D32',
      is_team_lead: false,
    };

    this.setCurrentUser(user);
    return { success: true, message: 'Logged in successfully.', user };
  }

  // --- MILESTONE PROGRESS RECALCULATION ---
  private recalculateMilestoneProgress(milestoneId: string): void {
    const milestoneTasks = this.state.tasks.filter((t) => t.milestone_id === milestoneId);
    const total = milestoneTasks.length;
    const done = milestoneTasks.filter((t) => t.status === 'Done').length;
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);

    this.state.milestones = this.state.milestones.map((m) => {
      if (m.id === milestoneId) {
        const isDone = percentage === 100;
        let newStatus = m.status;
        if (isDone) {
          newStatus = 'Done';
        } else if (done > 0 && m.status === 'Not Started') {
          newStatus = 'In Progress';
        }
        return {
          ...m,
          progress_percentage: percentage,
          status: newStatus,
          actual_completion_date: isDone ? m.actual_completion_date || new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString(),
        };
      }
      return m;
    });
  }

  public recalculateAllMilestoneProgress(): void {
    this.state.milestones.forEach((m) => this.recalculateMilestoneProgress(m.id));
  }

  // --- MILESTONES CRUD ---
  public addMilestone(data: {
    title: string;
    description: string;
    planned_date: string;
    support_required?: string;
    phase_label?: string;
    notes?: string;
  }): { success: boolean; message: string; milestone?: Milestone } {
    const cleanTitle = data.title.trim();
    if (!cleanTitle) {
      return { success: false, message: 'Milestone title is required.' };
    }

    if (this.state.milestones.some((m) => m.title.toLowerCase() === cleanTitle.toLowerCase())) {
      return { success: false, message: 'A milestone with this title already exists. Titles must be unique.' };
    }

    const newMilestone: Milestone = {
      id: 'm-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      title: cleanTitle,
      description: data.description || '',
      planned_date: data.planned_date,
      original_planned_date: data.planned_date,
      actual_completion_date: null,
      status: 'Not Started',
      progress_percentage: 0,
      support_required: data.support_required || '',
      notes: data.notes || '',
      phase_label: data.phase_label || `Month ${this.state.milestones.length + 1}`,
      sort_order: this.state.milestones.length + 1,
      archived: false,
      created_by: this.state.currentUser.email,
      updated_by: this.state.currentUser.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      date_history: [],
    };

    this.state.milestones = [...this.state.milestones, newMilestone];
    this.logActivity('CREATE', 'milestone', newMilestone.id, `${this.state.currentUser.full_name} created milestone "${newMilestone.title}".`);

    // Sync to Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('milestones').insert({
        id: newMilestone.id,
        title: newMilestone.title,
        description: newMilestone.description,
        planned_date: newMilestone.planned_date,
        original_planned_date: newMilestone.original_planned_date,
        status: newMilestone.status,
        progress_percentage: 0,
        support_required: newMilestone.support_required,
        notes: newMilestone.notes,
        phase_label: newMilestone.phase_label,
        sort_order: newMilestone.sort_order,
        created_by: newMilestone.created_by,
        updated_by: newMilestone.updated_by,
      }).then();
    }

    this.notify();
    return { success: true, message: 'Milestone added successfully.', milestone: newMilestone };
  }

  public updateMilestone(
    id: string,
    updates: Partial<Milestone>,
    rescheduleReason?: string
  ): { success: boolean; message: string } {
    const existing = this.state.milestones.find((m) => m.id === id);
    if (!existing) return { success: false, message: 'Milestone not found.' };

    let dateHistoryItem: MilestoneDateHistoryItem | null = null;
    let newDateHistory = existing.date_history || [];

    // Check if planned_date changed
    if (updates.planned_date && updates.planned_date !== existing.planned_date) {
      dateHistoryItem = {
        id: 'hist-' + Date.now().toString(36),
        milestone_id: id,
        old_date: existing.planned_date,
        new_date: updates.planned_date,
        reason: rescheduleReason || updates.notes || 'Rescheduled during sprint review',
        changed_by: this.state.currentUser.full_name,
        changed_at: new Date().toISOString(),
      };
      newDateHistory = [dateHistoryItem, ...newDateHistory];

      this.logActivity(
        'RESCHEDULE',
        'milestone',
        id,
        `${this.state.currentUser.full_name} rescheduled "${existing.title}" from ${existing.planned_date} to ${updates.planned_date}${rescheduleReason ? ` (${rescheduleReason})` : ''}.`
      );

      this.createNotification(
        'milestone_rescheduled',
        'Milestone Rescheduled',
        `"${existing.title}" rescheduled to ${updates.planned_date} by ${this.state.currentUser.full_name}.`
      );
    } else {
      this.logActivity('UPDATE', 'milestone', id, `${this.state.currentUser.full_name} updated milestone "${existing.title}".`);
    }

    const updatedMilestone: Milestone = {
      ...existing,
      ...updates,
      date_history: newDateHistory,
      updated_by: this.state.currentUser.email,
      updated_at: new Date().toISOString(),
    };

    this.state.milestones = this.state.milestones.map((m) => (m.id === id ? updatedMilestone : m));

    // Supabase update
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('milestones').update({
        title: updatedMilestone.title,
        description: updatedMilestone.description,
        planned_date: updatedMilestone.planned_date,
        status: updatedMilestone.status,
        support_required: updatedMilestone.support_required,
        notes: updatedMilestone.notes,
        phase_label: updatedMilestone.phase_label,
        sort_order: updatedMilestone.sort_order,
        archived: updatedMilestone.archived,
        updated_by: updatedMilestone.updated_by,
        updated_at: updatedMilestone.updated_at,
      }).eq('id', id).then();

      if (dateHistoryItem) {
        supabase.from('milestone_date_history').insert({
          milestone_id: id,
          old_date: dateHistoryItem.old_date,
          new_date: dateHistoryItem.new_date,
          reason: dateHistoryItem.reason,
          changed_by: dateHistoryItem.changed_by,
        }).then();
      }
    }

    this.notify();
    return { success: true, message: 'Milestone updated successfully.' };
  }

  public reorderMilestones(newOrderIds: string[]): void {
    this.state.milestones = this.state.milestones.map((m) => {
      const index = newOrderIds.indexOf(m.id);
      return index !== -1 ? { ...m, sort_order: index + 1 } : m;
    });

    this.notify();
  }

  public archiveMilestone(id: string, archived: boolean): void {
    const existing = this.state.milestones.find((m) => m.id === id);
    if (!existing) return;

    this.state.milestones = this.state.milestones.map((m) =>
      m.id === id ? { ...m, archived, updated_at: new Date().toISOString() } : m
    );

    this.logActivity(
      archived ? 'ARCHIVE' : 'RESTORE',
      'milestone',
      id,
      `${this.state.currentUser.full_name} ${archived ? 'archived' : 'restored'} milestone "${existing.title}".`
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('milestones').update({ archived }).eq('id', id).then();
    }

    this.notify();
  }

  public duplicateMilestone(id: string): { success: boolean; message: string; milestone?: Milestone } {
    const original = this.state.milestones.find((m) => m.id === id);
    if (!original) return { success: false, message: 'Milestone not found.' };

    const newTitle = `${original.title} (Copy)`;
    const newId = 'm-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    const clonedMilestone: Milestone = {
      ...original,
      id: newId,
      title: newTitle,
      status: 'Not Started',
      progress_percentage: 0,
      actual_completion_date: null,
      sort_order: this.state.milestones.length + 1,
      created_by: this.state.currentUser.email,
      updated_by: this.state.currentUser.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      date_history: [],
    };

    // Duplicate all tasks belonging to this milestone
    const originalTasks = this.state.tasks.filter((t) => t.milestone_id === id);
    const clonedTasks: Task[] = originalTasks.map((t, idx) => ({
      ...t,
      id: 't-' + Date.now().toString(36) + idx,
      milestone_id: newId,
      status: 'Todo',
      completed_at: null,
      created_by: this.state.currentUser.email,
      updated_by: this.state.currentUser.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      comments: [],
    }));

    this.state.milestones = [...this.state.milestones, clonedMilestone];
    this.state.tasks = [...this.state.tasks, ...clonedTasks];

    this.logActivity('DUPLICATE', 'milestone', newId, `${this.state.currentUser.full_name} duplicated milestone "${original.title}".`);

    this.notify();
    return { success: true, message: 'Milestone duplicated with all its tasks.', milestone: clonedMilestone };
  }

  public deleteMilestone(id: string): { success: boolean; message: string } {
    if (!this.isCurrentUserTeamLead()) {
      return { success: false, message: 'Permission denied: Only the Team Lead (Nithyasree M) can delete milestones.' };
    }

    const target = this.state.milestones.find((m) => m.id === id);
    if (!target) return { success: false, message: 'Milestone not found.' };

    this.state.milestones = this.state.milestones.filter((m) => m.id !== id);
    this.state.tasks = this.state.tasks.filter((t) => t.milestone_id !== id);

    this.logActivity('DELETE', 'milestone', id, `${this.state.currentUser.full_name} deleted milestone "${target.title}".`);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('milestones').delete().eq('id', id).then();
    }

    this.notify();
    return { success: true, message: 'Milestone deleted successfully.' };
  }

  // --- TASKS CRUD ---
  public addTask(data: {
    milestone_id: string;
    title: string;
    assignee_id?: string;
    deadline?: string;
    priority?: TaskPriority;
    notes?: string;
  }): { success: boolean; message: string; task?: Task } {
    const cleanTitle = data.title.trim();
    if (!cleanTitle) {
      return { success: false, message: 'Task title is required.' };
    }

    const milestone = this.state.milestones.find((m) => m.id === data.milestone_id);
    if (!milestone) return { success: false, message: 'Parent milestone not found.' };

    const assigneeMember = SEED_MEMBERS.find(
      (m) => m.email === data.assignee_id || m.full_name === data.assignee_id
    );

    const newTask: Task = {
      id: 't-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      milestone_id: data.milestone_id,
      title: cleanTitle,
      assignee_id: assigneeMember?.email || data.assignee_id || this.state.currentUser.email,
      assignee_name: assigneeMember?.full_name || this.state.currentUser.full_name,
      deadline: data.deadline || milestone.planned_date,
      status: 'Todo',
      priority: data.priority || 'Med',
      notes: data.notes || '',
      completed_at: null,
      sort_order: this.state.tasks.filter((t) => t.milestone_id === data.milestone_id).length + 1,
      created_by: this.state.currentUser.email,
      updated_by: this.state.currentUser.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      comments: [],
    };

    this.state.tasks = [...this.state.tasks, newTask];
    this.recalculateMilestoneProgress(data.milestone_id);

    this.logActivity('CREATE', 'task', newTask.id, `${this.state.currentUser.full_name} added task "${newTask.title}" to ${milestone.title}.`);

    if (newTask.assignee_id && newTask.assignee_id !== this.state.currentUser.email) {
      this.createNotification(
        'task_assigned',
        'New Task Assigned',
        `${this.state.currentUser.full_name} assigned you: "${newTask.title}".`,
        newTask.assignee_id
      );
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('tasks').insert({
        id: newTask.id,
        milestone_id: newTask.milestone_id,
        title: newTask.title,
        assignee_id: newTask.assignee_id,
        assignee_name: newTask.assignee_name,
        deadline: newTask.deadline,
        status: newTask.status,
        priority: newTask.priority,
        notes: newTask.notes,
        created_by: newTask.created_by,
        updated_by: newTask.updated_by,
      }).then();
    }

    this.notify();
    return { success: true, message: 'Task added successfully.', task: newTask };
  }

  public updateTask(id: string, updates: Partial<Task>): { success: boolean; message: string } {
    const existing = this.state.tasks.find((t) => t.id === id);
    if (!existing) return { success: false, message: 'Task not found.' };

    const oldMilestoneId = existing.milestone_id;
    let completedAt = existing.completed_at;

    if (updates.status && updates.status !== existing.status) {
      const oldLabel = existing.status === 'Todo' ? 'Not Started' : existing.status;
      const newLabel = updates.status === 'Todo' ? 'Not Started' : updates.status;
      completedAt = updates.status === 'Done' ? new Date().toISOString() : null;
      const actorShort = this.state.currentUser.full_name.split(' ')[0];
      this.logActivity('STATUS', 'task', id, `${actorShort} updated "${existing.title}" (status ${oldLabel} → ${newLabel})`);
    }

    if (updates.deadline && updates.deadline !== existing.deadline) {
      this.logActivity('DEADLINE', 'task', id, `${this.state.currentUser.full_name} changed deadline of "${existing.title}" from ${existing.deadline || 'none'} to ${updates.deadline}.`);
    }

    if (updates.assignee_id && updates.assignee_id !== existing.assignee_id) {
      const newAssignee = SEED_MEMBERS.find((m) => m.email === updates.assignee_id);
      updates.assignee_name = newAssignee?.full_name || updates.assignee_id;
      this.logActivity('REASSIGN', 'task', id, `${this.state.currentUser.full_name} reassigned "${existing.title}" to ${updates.assignee_name}.`);

      if (updates.assignee_id !== this.state.currentUser.email) {
        this.createNotification(
          'task_assigned',
          'Task Reassigned to You',
          `${this.state.currentUser.full_name} reassigned "${existing.title}" to you.`,
          updates.assignee_id
        );
      }
    }

    const updatedTask: Task = {
      ...existing,
      ...updates,
      completed_at: completedAt,
      updated_by: this.state.currentUser.email,
      updated_at: new Date().toISOString(),
    };

    this.state.tasks = this.state.tasks.map((t) => (t.id === id ? updatedTask : t));

    // Recalculate milestone progress for current milestone and old milestone if moved
    this.recalculateMilestoneProgress(updatedTask.milestone_id);
    if (updatedTask.milestone_id !== oldMilestoneId) {
      this.recalculateMilestoneProgress(oldMilestoneId);
      this.logActivity('MOVE', 'task', id, `${this.state.currentUser.full_name} moved "${existing.title}" to another milestone.`);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('tasks').update({
        milestone_id: updatedTask.milestone_id,
        title: updatedTask.title,
        assignee_id: updatedTask.assignee_id,
        assignee_name: updatedTask.assignee_name,
        deadline: updatedTask.deadline,
        status: updatedTask.status,
        priority: updatedTask.priority,
        notes: updatedTask.notes,
        completed_at: updatedTask.completed_at,
        updated_by: updatedTask.updated_by,
        updated_at: updatedTask.updated_at,
      }).eq('id', id).then();
    }

    this.notify();
    return { success: true, message: 'Task updated successfully.' };
  }

  public toggleTaskStatus(id: string): { success: boolean; message: string; newStatus?: TaskStatus } {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return { success: false, message: 'Task not found.' };

    const wasDone = task.status === 'Done';
    const newStatus: TaskStatus = wasDone ? 'Todo' : 'Done';
    const completedAt = wasDone ? null : new Date().toISOString();

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      completed_at: completedAt,
      updated_by: this.state.currentUser.email,
      updated_at: new Date().toISOString(),
    };

    this.state.tasks = this.state.tasks.map((t) => (t.id === id ? updatedTask : t));
    this.recalculateMilestoneProgress(task.milestone_id);

    const actor = this.state.currentUser.full_name;
    const actionDesc = wasDone
      ? `${actor} reopened task "${task.title}"`
      : `${actor} marked "${task.title}" as Done`;
    this.logActivity('STATUS', 'task', id, actionDesc);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('tasks')
        .update({
          status: newStatus,
          completed_at: completedAt,
          updated_by: updatedTask.updated_by,
          updated_at: updatedTask.updated_at,
        })
        .eq('id', id)
        .then();
    }

    this.notify();
    return { success: true, message: actionDesc, newStatus };
  }

  public deleteTask(id: string): { success: boolean; message: string; canUndo: boolean } {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return { success: false, message: 'Task not found.', canUndo: false };

    // All 4 team members have permission to delete tasks

    // Clear any previous undo timeout
    if (this.state.deletedTaskUndoStack) {
      clearTimeout(this.state.deletedTaskUndoStack.timeoutId);
    }

    // Set 10-second undo stack
    const timeoutId = setTimeout(() => {
      // Actually finalize permanent delete on Supabase after 10s
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.from('tasks').delete().eq('id', id).then();
      }
      this.state.deletedTaskUndoStack = null;
      this.notify();
    }, 10000);

    this.state.deletedTaskUndoStack = {
      task: { ...task },
      timeoutId,
      timestamp: Date.now(),
    };

    // Remove from active state immediately (optimistic UI)
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
    this.recalculateMilestoneProgress(task.milestone_id);
    this.logActivity('DELETE', 'task', id, `${this.state.currentUser.full_name} deleted task "${task.title}".`);

    this.notify();
    return { success: true, message: `Task "${task.title}" deleted. (Undo available for 10s)`, canUndo: true };
  }

  public undoDeleteTask(): { success: boolean; message: string } {
    if (!this.state.deletedTaskUndoStack) {
      return { success: false, message: 'No deleted task to restore.' };
    }

    clearTimeout(this.state.deletedTaskUndoStack.timeoutId);
    const restoredTask = this.state.deletedTaskUndoStack.task;
    this.state.deletedTaskUndoStack = null;

    this.state.tasks = [...this.state.tasks, restoredTask];
    this.recalculateMilestoneProgress(restoredTask.milestone_id);
    this.logActivity('RESTORE', 'task', restoredTask.id, `${this.state.currentUser.full_name} restored task "${restoredTask.title}".`);

    this.notify();
    return { success: true, message: `Task "${restoredTask.title}" restored successfully.` };
  }

  public bulkUpdateTasks(taskIds: string[], updates: { status?: TaskStatus; assignee_id?: string }): void {
    if (taskIds.length === 0) return;

    let assigneeName: string | undefined;
    if (updates.assignee_id) {
      assigneeName = SEED_MEMBERS.find((m) => m.email === updates.assignee_id)?.full_name || updates.assignee_id;
    }

    const affectedMilestones = new Set<string>();

    this.state.tasks = this.state.tasks.map((task) => {
      if (taskIds.includes(task.id)) {
        affectedMilestones.add(task.milestone_id);
        const newStatus = updates.status || task.status;
        const isDone = newStatus === 'Done';
        return {
          ...task,
          status: newStatus,
          completed_at: isDone ? task.completed_at || new Date().toISOString() : null,
          assignee_id: updates.assignee_id !== undefined ? updates.assignee_id : task.assignee_id,
          assignee_name: assigneeName !== undefined ? assigneeName : task.assignee_name,
          updated_by: this.state.currentUser.email,
          updated_at: new Date().toISOString(),
        };
      }
      return task;
    });

    affectedMilestones.forEach((mId) => this.recalculateMilestoneProgress(mId));

    this.logActivity(
      'BULK_UPDATE',
      'task',
      taskIds.join(','),
      `${this.state.currentUser.full_name} bulk updated ${taskIds.length} tasks.`
    );

    this.notify();
  }

  public addTaskComment(taskId: string, content: string): { success: boolean; message: string } {
    const clean = content.trim();
    if (!clean) return { success: false, message: 'Comment cannot be empty.' };

    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, message: 'Task not found.' };

    const comment: TaskComment = {
      id: 'comm-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      task_id: taskId,
      user_id: this.state.currentUser.email,
      user_name: this.state.currentUser.full_name,
      user_role: this.state.currentUser.role,
      user_color: this.state.currentUser.avatar_color,
      content: clean,
      created_at: new Date().toISOString(),
    };

    const newComments = [...(task.comments || []), comment];

    this.state.tasks = this.state.tasks.map((t) =>
      t.id === taskId ? { ...t, comments: newComments, updated_at: new Date().toISOString() } : t
    );

    this.logActivity('COMMENT', 'task', taskId, `${this.state.currentUser.full_name} commented on "${task.title}".`);

    if (task.assignee_id && task.assignee_id !== this.state.currentUser.email) {
      this.createNotification(
        'new_comment',
        'New Comment on Your Task',
        `${this.state.currentUser.full_name} commented on "${task.title}": "${clean.substring(0, 60)}..."`,
        task.assignee_id
      );
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('task_comments').insert({
        id: comment.id,
        task_id: comment.task_id,
        user_id: comment.user_id,
        user_name: comment.user_name,
        user_role: comment.user_role,
        user_color: comment.user_color,
        content: comment.content,
      }).then();
    }

    this.notify();
    return { success: true, message: 'Comment added.' };
  }

  // --- MEETINGS CRUD ---
  public addMeeting(data: Omit<Meeting, 'id' | 'created_by' | 'created_by_name' | 'created_at' | 'updated_at'>): Meeting {
    const newMeeting: Meeting = {
      ...data,
      id: 'mtg-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      created_by: this.state.currentUser.email,
      created_by_name: this.state.currentUser.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      action_items: data.action_items || [],
    };

    this.state.meetings = [newMeeting, ...this.state.meetings];
    this.logActivity('CREATE', 'meeting', newMeeting.id, `${this.state.currentUser.full_name} recorded meeting "${newMeeting.title}".`);

    this.createNotification(
      'new_meeting',
      'New Meeting Logged',
      `${this.state.currentUser.full_name} logged meeting "${newMeeting.title}".`
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('meetings').insert({
        id: newMeeting.id,
        title: newMeeting.title,
        meeting_date: newMeeting.meeting_date,
        type: newMeeting.type,
        attendees: newMeeting.attendees,
        guest_attendees: newMeeting.guest_attendees,
        agenda: newMeeting.agenda,
        notes: newMeeting.notes,
        key_decisions: newMeeting.key_decisions,
        inferences_learnings: newMeeting.inferences_learnings,
        attachment_urls: newMeeting.attachment_urls || [],
        created_by: newMeeting.created_by,
        created_by_name: newMeeting.created_by_name,
      }).then();
    }

    this.notify();
    return newMeeting;
  }

  public updateMeeting(id: string, updates: Partial<Meeting>): { success: boolean; message: string } {
    const existing = this.state.meetings.find((m) => m.id === id);
    if (!existing) return { success: false, message: 'Meeting not found.' };

    const isCreator = existing.created_by.toLowerCase() === this.state.currentUser.email.toLowerCase();
    if (!isCreator && !this.isCurrentUserTeamLead()) {
      return { success: false, message: 'Permission denied: Only the meeting creator or Team Lead can edit this meeting.' };
    }

    const updated: Meeting = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.state.meetings = this.state.meetings.map((m) => (m.id === id ? updated : m));
    this.logActivity('UPDATE', 'meeting', id, `${this.state.currentUser.full_name} updated meeting "${existing.title}".`);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('meetings').update({
        title: updated.title,
        meeting_date: updated.meeting_date,
        type: updated.type,
        attendees: updated.attendees,
        guest_attendees: updated.guest_attendees,
        agenda: updated.agenda,
        notes: updated.notes,
        key_decisions: updated.key_decisions,
        inferences_learnings: updated.inferences_learnings,
        attachment_urls: updated.attachment_urls,
        updated_at: updated.updated_at,
      }).eq('id', id).then();
    }

    this.notify();
    return { success: true, message: 'Meeting updated.' };
  }

  public deleteMeeting(id: string): { success: boolean; message: string } {
    const existing = this.state.meetings.find((m) => m.id === id);
    if (!existing) return { success: false, message: 'Meeting not found.' };

    this.state.meetings = this.state.meetings.filter((m) => m.id !== id);
    this.logActivity('DELETE', 'meeting', id, `${this.state.currentUser.full_name} deleted meeting "${existing.title}".`);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('meetings').delete().eq('id', id).then();
    }

    this.notify();
    return { success: true, message: 'Meeting deleted.' };
  }

  public convertActionItemToTask(
    meetingId: string,
    actionItemId: string,
    milestoneId: string
  ): { success: boolean; message: string; task?: Task } {
    const meeting = this.state.meetings.find((m) => m.id === meetingId);
    if (!meeting) return { success: false, message: 'Meeting not found.' };

    const actionItem = meeting.action_items?.find((a) => a.id === actionItemId);
    if (!actionItem) return { success: false, message: 'Action item not found.' };

    const milestone = this.state.milestones.find((m) => m.id === milestoneId);
    if (!milestone) return { success: false, message: 'Target milestone not found.' };

    // Find assignee
    const assignee = SEED_MEMBERS.find(
      (m) => m.full_name.toLowerCase() === actionItem.assignee?.toLowerCase() || m.email === actionItem.assignee
    );

    const taskResult = this.addTask({
      milestone_id: milestoneId,
      title: actionItem.text,
      assignee_id: assignee?.email || this.state.currentUser.email,
      deadline: actionItem.due_date || milestone.planned_date,
      priority: 'Med',
      notes: `Converted from Meeting: "${meeting.title}" on ${new Date(meeting.meeting_date).toLocaleDateString()}`,
    });

    if (taskResult.success && taskResult.task) {
      // Mark action item as converted
      const updatedActionItems = (meeting.action_items || []).map((a) =>
        a.id === actionItemId ? { ...a, status: 'converted' as const, converted_task_id: taskResult.task!.id } : a
      );

      this.state.meetings = this.state.meetings.map((m) =>
        m.id === meetingId ? { ...m, action_items: updatedActionItems } : m
      );

      this.logActivity(
        'CONVERT_ACTION',
        'task',
        taskResult.task.id,
        `${this.state.currentUser.full_name} converted meeting action item into task "${taskResult.task.title}".`
      );

      this.notify();
      return { success: true, message: `Action item converted to task in "${milestone.title}".`, task: taskResult.task };
    }

    return { success: false, message: taskResult.message };
  }

  // --- DOCUMENTS CRUD ---
  public addDocument(data: Omit<DocumentItem, 'id' | 'uploaded_by' | 'uploaded_by_name' | 'created_at' | 'updated_at'>): DocumentItem {
    const newDoc: DocumentItem = {
      ...data,
      id: 'doc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      uploaded_by: this.state.currentUser.email,
      uploaded_by_name: this.state.currentUser.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.state.documents = [newDoc, ...this.state.documents];
    this.logActivity('UPLOAD', 'document', newDoc.id, `${this.state.currentUser.full_name} uploaded document "${newDoc.title}".`);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('documents').insert({
        id: newDoc.id,
        title: newDoc.title,
        description: newDoc.description,
        category: newDoc.category,
        tags: newDoc.tags,
        file_url: newDoc.file_url,
        file_name: newDoc.file_name,
        file_size: newDoc.file_size,
        file_type: newDoc.file_type,
        is_external_link: newDoc.is_external_link,
        milestone_id: newDoc.milestone_id,
        uploaded_by: newDoc.uploaded_by,
        uploaded_by_name: newDoc.uploaded_by_name,
      }).then();
    }

    this.notify();
    return newDoc;
  }

  public updateDocument(id: string, updates: Partial<DocumentItem>): { success: boolean; message: string } {
    const existing = this.state.documents.find((d) => d.id === id);
    if (!existing) return { success: false, message: 'Document not found.' };

    const isUploader = existing.uploaded_by.toLowerCase() === this.state.currentUser.email.toLowerCase();
    if (!isUploader && !this.isCurrentUserTeamLead()) {
      return { success: false, message: 'Permission denied: Only the uploader or Team Lead can edit this document.' };
    }

    const updated: DocumentItem = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.state.documents = this.state.documents.map((d) => (d.id === id ? updated : d));
    this.logActivity('UPDATE', 'document', id, `${this.state.currentUser.full_name} updated document "${existing.title}".`);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('documents').update({
        title: updated.title,
        description: updated.description,
        category: updated.category,
        tags: updated.tags,
        milestone_id: updated.milestone_id,
        updated_at: updated.updated_at,
      }).eq('id', id).then();
    }

    this.notify();
    return { success: true, message: 'Document updated.' };
  }

  public deleteDocument(id: string): { success: boolean; message: string } {
    const existing = this.state.documents.find((d) => d.id === id);
    if (!existing) return { success: false, message: 'Document not found.' };

    this.state.documents = this.state.documents.filter((d) => d.id !== id);
    this.logActivity('DELETE', 'document', id, `${this.state.currentUser.full_name} deleted document "${existing.title}".`);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('documents').delete().eq('id', id).then();
    }

    this.notify();
    return { success: true, message: 'Document deleted.' };
  }

  // --- NOTIFICATIONS & ACTIVITY ---
  public createNotification(
    type: NotificationItem['type'],
    title: string,
    message: string,
    targetEmail?: string
  ): void {
    const email = targetEmail || this.state.currentUser.email;
    const notif: NotificationItem = {
      id: 'notif-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      user_email: email,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
    };

    this.state.notifications = [notif, ...this.state.notifications].slice(0, 50);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('notifications').insert(notif).then();
    }

    this.notify();
  }

  public markNotificationAsRead(id: string): void {
    this.state.notifications = this.state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.notify();
  }

  public markAllNotificationsAsRead(): void {
    this.state.notifications = this.state.notifications.map((n) => ({ ...n, read: true }));
    this.notify();
  }

  public clearAllNotifications(): void {
    this.state.notifications = [];
    this.notify();
  }

  private logActivity(
    action: string,
    entity_type: ActivityLogItem['entity_type'],
    entity_id: string,
    details: string
  ): void {
    const item: ActivityLogItem = {
      id: 'act-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      actor_name: this.state.currentUser.full_name,
      action,
      entity_type,
      entity_id,
      details,
      created_at: new Date().toISOString(),
    };

    this.state.activityLog = [item, ...this.state.activityLog].slice(0, 100);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('activity_log').insert(item).then();
    }
  }

  public resetToFactorySeed(): void {
    this.state.milestones = INITIAL_MILESTONES;
    this.state.tasks = INITIAL_TASKS;
    this.state.meetings = INITIAL_MEETINGS;
    this.state.documents = INITIAL_DOCUMENTS;
    this.recalculateAllMilestoneProgress();
    this.logActivity('RESET', 'milestone', 'all', `${this.state.currentUser.full_name} reset data to initial Plant Lipids PoC seeds.`);
    this.notify();
  }
}

export const realtimeStore = new RealtimeStore();
