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
  onlineUsers: { email: string; full_name: string; online_at: string }[];
  liveCollaborationAlert: { id: string; message: string; actor: string; timestamp: number } | null;
  recentTaskActions: Record<string, { actor: string; action: string; timestamp: number }>;
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

function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // Ignore audio policy errors
  }
}

class RealtimeStore {
  private state: StoreState;
  private listeners: Set<Listener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseSubscription: any = null;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private liveAlertTimeout: any = null;
  private syncPollingInterval: any = null;

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
        onlineUsers: [],
        liveCollaborationAlert: null,
        recentTaskActions: {},
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
        onlineUsers: [],
        liveCollaborationAlert: null,
        recentTaskActions: {},
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

    this.setupLifecycleListeners();
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

  private resolveMemberDisplayName(email: string, dbFullName?: string | null): string {
    const trimmed = (dbFullName || '').trim();
    const emailPrefix = email.split('@')[0].toLowerCase();
    if (!trimmed || trimmed.toLowerCase() === emailPrefix) {
      const seedMatch = SEED_MEMBERS.find(
        (m) => m.email.toLowerCase() === email.toLowerCase()
      );
      if (seedMatch) {
        return seedMatch.full_name;
      }
    }
    return trimmed || email.split('@')[0];
  }

  private handleProfileRealtime(payload: any): void {
    const updated = payload?.new;
    if (!updated || !updated.id) return;
    const resolvedName = this.resolveMemberDisplayName(updated.email || '', updated.full_name);
    let changed = false;
    this.state.teamMembers = this.state.teamMembers.map((m) => {
      if (m.id === updated.id) {
        changed = true;
        return {
          ...m,
          full_name: resolvedName,
          avatar_color: updated.avatar_color ?? m.avatar_color,
          role: (updated.role as MemberRole) ?? m.role,
          is_team_lead:
            updated.is_team_lead !== undefined ? Boolean(updated.is_team_lead) : m.is_team_lead,
        };
      }
      return m;
    });
    if (this.state.currentUser.id === updated.id) {
      changed = true;
      this.state.currentUser = {
        ...this.state.currentUser,
        full_name: resolvedName,
        avatar_color: updated.avatar_color ?? this.state.currentUser.avatar_color,
        role: (updated.role as MemberRole) ?? this.state.currentUser.role,
        is_team_lead:
          updated.is_team_lead !== undefined
            ? Boolean(updated.is_team_lead)
            : this.state.currentUser.is_team_lead,
      };
    }
    if (changed) {
      this.notify();
    }
  }

  public async updateMemberProfile(
    memberId: string,
    updates: { full_name: string; avatar_color: string }
  ): Promise<{ success: boolean; message: string }> {
    const cleanName = updates.full_name.trim();
    if (!cleanName) {
      return { success: false, message: 'Full name cannot be empty.' };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          avatar_color: updates.avatar_color,
        })
        .eq('id', memberId);

      if (error) {
        return { success: false, message: error.message };
      }
    }

    this.state.teamMembers = this.state.teamMembers.map((m) =>
      m.id === memberId ? { ...m, full_name: cleanName, avatar_color: updates.avatar_color } : m
    );
    if (this.state.currentUser.id === memberId) {
      this.state.currentUser = {
        ...this.state.currentUser,
        full_name: cleanName,
        avatar_color: updates.avatar_color,
      };
    }
    this.notify();
    return { success: true, message: 'Profile updated successfully.' };
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

  public async activateInvitedAccount(
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Try secure Postgres RPC if installed
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('set_member_password', {
        target_email: cleanEmail,
        new_password: password,
      });

      if (!rpcError && rpcData?.success) {
        return await this.signInWithPassword(cleanEmail, password);
      }
    } catch {
      // RPC not yet installed or failed, proceed to next methods
    }

    // 2. Try standard signUp (works if account hasn't been created yet in auth.users)
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (!signUpErr && signUpData.user) {
        // Automatically try to sign in
        const signInRes = await this.signInWithPassword(cleanEmail, password);
        if (signInRes.success) {
          return signInRes;
        }
      }
    } catch {
      // Continue to Edge Function
    }

    // 3. Invoke activate-invite Edge Function
    const { data, error } = await supabase.functions.invoke('activate-invite', {
      body: {
        email: cleanEmail,
        password,
      },
    });

    if (error) {
      let msg = error.message || 'Failed to set up account.';
      try {
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) msg = body.error;
        }
      } catch {
        // ignore parse error
      }

      if (msg.toLowerCase().includes('activation code')) {
        msg =
          'Your Supabase Edge Function in the cloud is still running the old code with activation codes. Please deploy the updated activate-invite function using: supabase functions deploy activate-invite --no-verify-jwt (or run the set_member_password SQL snippet in Supabase SQL editor).';
      }

      return { success: false, message: msg };
    }

    if (data?.error) {
      let msg = data.error;
      if (msg.toLowerCase().includes('activation code')) {
        msg =
          'Your Supabase Edge Function in the cloud is still running the old code with activation codes. Please deploy the updated activate-invite function using: supabase functions deploy activate-invite --no-verify-jwt (or run the set_member_password SQL snippet in Supabase SQL editor).';
      }
      return { success: false, message: msg };
    }

    return await this.signInWithPassword(cleanEmail, password);
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

    // 2. Fetch active workspace membership (or activate pending invitation by email)
    let { data: membership, error: memberErr } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if ((memberErr || !membership) && profile.email) {
      const { data: pendingInvite } = await supabase
        .from('workspace_members')
        .select('*')
        .ilike('invited_email', profile.email.trim())
        .eq('status', 'invited')
        .limit(1)
        .single();

      if (pendingInvite) {
        const { data: activated, error: activateErr } = await supabase
          .from('workspace_members')
          .update({
            user_id: userId,
            status: 'active',
          })
          .eq('id', pendingInvite.id)
          .select('*')
          .single();

        if (!activateErr && activated) {
          membership = activated;
          memberErr = null;
        }
      }
    }

    if (memberErr || !membership) {
      this.state.authStatus = 'unauthenticated';
      this.state.authError = 'You do not have an active workspace membership.';
      this.state.isSyncing = false;
      this.notify();
      return;
    }

    const workspaceId = membership.workspace_id as string;

    // 3. Fetch workspace info & workspace members (active + invited)
    const [wsRes, wmRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase
        .from('workspace_members')
        .select('user_id, invited_email, status')
        .eq('workspace_id', workspaceId),
    ]);

    const activeRows = (wmRes.data || []).filter((r: any) => r.status === 'active');
    const invitedEmails = (wmRes.data || [])
      .filter(
        (r: any) =>
          r.status === 'invited' &&
          r.invited_email &&
          !String(r.invited_email).toLowerCase().includes('nahypin')
      )
      .map((r: any) => String(r.invited_email).toLowerCase());

    const combinedAllowed = Array.from(
      new Set([...this.state.allowedEmails, ...invitedEmails])
    ).filter((email) => !email.toLowerCase().includes('nahypin'));

    this.state.allowedEmails = combinedAllowed;

    const memberIds = activeRows.map((r: any) => r.user_id).filter(Boolean);
    let teamMembers: Member[] = [];
    if (memberIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberIds);
      teamMembers = (profilesData || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: this.resolveMemberDisplayName(p.email, p.full_name),
        role: p.role as MemberRole,
        avatar_color: p.avatar_color,
        is_team_lead: Boolean(p.is_team_lead),
      }));
    }

    const resolvedCurrentName = this.resolveMemberDisplayName(profile.email, profile.full_name);
    if (
      resolvedCurrentName &&
      (!profile.full_name ||
        profile.full_name.trim().toLowerCase() === profile.email.split('@')[0].toLowerCase())
    ) {
      await supabase
        .from('profiles')
        .update({ full_name: resolvedCurrentName })
        .eq('id', userId);
    }

    this.state.currentUser = {
      id: profile.id,
      email: profile.email,
      full_name: resolvedCurrentName,
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

    // 5. Subscribe to Realtime channel with Broadcast, Presence and resilient Postgres changes
    if (this.supabaseSubscription) {
      try {
        await supabase.removeChannel(this.supabaseSubscription);
      } catch {}
      this.supabaseSubscription = null;
    }

    const channel = supabase.channel(`spiceguard-ws-${workspaceId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: this.state.currentUser.email || this.state.currentUser.id },
      },
    });

    channel
      .on('broadcast', { event: 'TASK_MUTATION' }, ({ payload }) => {
        this.handleBroadcastTask(payload);
      })
      .on('broadcast', { event: 'MILESTONE_MUTATION' }, ({ payload }) => {
        this.handleBroadcastMilestone(payload);
      })
      .on('broadcast', { event: 'ACTIVITY_LOG' }, ({ payload }) => {
        this.handleBroadcastActivity(payload);
      })
      .on('broadcast', { event: 'NOTIFICATION' }, ({ payload }) => {
        if (payload?.notif) {
          this.handleNotificationRealtime({ eventType: 'INSERT', new: payload.notif });
        }
      })
      .on('broadcast', { event: 'SYNC_TRIGGER' }, () => {
        this.refreshWorkspaceData(workspaceId);
      })
      .on('presence', { event: 'sync' }, () => {
        this.handlePresenceSync(channel.presenceState());
      })
      .on('presence', { event: 'join' }, () => {
        this.handlePresenceSync(channel.presenceState());
      })
      .on('presence', { event: 'leave' }, () => {
        this.handlePresenceSync(channel.presenceState());
      })
      // Database change events without restrictive filter:
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleMilestoneRealtime(payload);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestone_date_history' }, () => {
        this.refreshWorkspaceData(workspaceId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleTaskRealtime(payload);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleCommentRealtime(payload);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleMeetingRealtime(payload);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_action_items' }, () => {
        this.refreshWorkspaceData(workspaceId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleDocumentRealtime(payload);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleNotificationRealtime(payload);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, (payload) => {
        if (this.isPayloadForCurrentWorkspace(payload, workspaceId)) {
          this.handleActivityRealtime(payload);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        this.handleProfileRealtime(payload);
      })
      .subscribe(async (status) => {
        this.state.isRealtimeConnected = status === 'SUBSCRIBED';
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              email: this.state.currentUser.email,
              full_name: this.state.currentUser.full_name,
              online_at: new Date().toISOString(),
            });
          } catch {}
        }
        this.state.isSyncing = false;
        this.state.lastSyncTime = new Date();
        this.notify();
      });

    this.supabaseSubscription = channel;
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
        const isForMe = !n.user_email || n.user_email.toLowerCase() === this.state.currentUser.email.toLowerCase();
        if (isForMe) {
          playNotificationChime();
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification(n.title, {
                body: n.message,
                icon: '/favicon.ico',
              });
            } catch {}
          }
        }
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

  private isPayloadForCurrentWorkspace(payload: any, workspaceId: string): boolean {
    const row = payload.new || payload.old;
    if (!row) return true;
    if (row.workspace_id && row.workspace_id !== workspaceId) return false;
    return true;
  }

  public setLiveAlert(message: string, actor: string): void {
    if (this.liveAlertTimeout) {
      clearTimeout(this.liveAlertTimeout);
      this.liveAlertTimeout = null;
    }

    this.state.liveCollaborationAlert = {
      id: 'alert-' + Date.now(),
      message,
      actor,
      timestamp: Date.now(),
    };
    this.notify();

    this.liveAlertTimeout = setTimeout(() => {
      this.state.liveCollaborationAlert = null;
      this.notify();
    }, 4500);
  }

  public dismissLiveAlert(): void {
    if (this.liveAlertTimeout) {
      clearTimeout(this.liveAlertTimeout);
      this.liveAlertTimeout = null;
    }
    this.state.liveCollaborationAlert = null;
    this.notify();
  }

  public broadcastEvent(event: string, payload: any): void {
    if (this.supabaseSubscription) {
      try {
        this.supabaseSubscription.send({
          type: 'broadcast',
          event,
          payload,
        });
      } catch (e) {
        console.warn('Realtime broadcast error:', e);
      }
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: event, payload });
      } catch {}
    }
  }

  private handleBroadcastTask(payload: any): void {
    const { action, task, actor, message } = payload;
    if (!task || !task.id) return;

    if (action === 'delete') {
      this.state.tasks = this.state.tasks.filter((t) => t.id !== task.id);
    } else if (action === 'create') {
      if (!this.state.tasks.some((t) => t.id === task.id)) {
        this.state.tasks = [...this.state.tasks, task];
      }
    } else {
      this.state.tasks = this.state.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t));
    }

    if (task.milestone_id) {
      this.recalculateMilestoneProgress(task.milestone_id);
    }

    this.state.recentTaskActions[task.id] = {
      actor: actor || 'Team',
      action: action || 'updated',
      timestamp: Date.now(),
    };

    if (actor && actor.toLowerCase() !== this.state.currentUser.full_name.toLowerCase()) {
      const alertMsg = message || `⚡ ${actor} ${action === 'reopen' ? 'reopened' : action === 'complete' ? 'completed' : 'updated'} "${task.title}"`;
      this.setLiveAlert(alertMsg, actor);
      playNotificationChime();
    }

    this.notify();
  }

  private handleBroadcastMilestone(payload: any): void {
    const { milestone, actor, message } = payload;
    if (!milestone || !milestone.id) return;

    this.state.milestones = this.state.milestones.map((m) =>
      m.id === milestone.id ? { ...m, ...milestone } : m
    );

    if (actor && actor.toLowerCase() !== this.state.currentUser.full_name.toLowerCase()) {
      this.setLiveAlert(message || `⚡ ${actor} updated milestone "${milestone.title}"`, actor);
      playNotificationChime();
    }

    this.notify();
  }

  private handleBroadcastActivity(payload: any): void {
    const item = payload.item as ActivityLogItem;
    if (item && item.id) {
      if (!this.state.activityLog.some((a) => a.id === item.id)) {
        this.state.activityLog = [item, ...this.state.activityLog].slice(0, 50);
        this.notify();
      }
    }
  }

  private handlePresenceSync(presenceState: any): void {
    if (!presenceState) return;
    const users: { email: string; full_name: string; online_at: string }[] = [];
    Object.keys(presenceState).forEach((key) => {
      const presences = presenceState[key] || [];
      presences.forEach((p: any) => {
        if (p.email && !users.some((u) => u.email.toLowerCase() === p.email.toLowerCase())) {
          users.push({
            email: p.email,
            full_name: p.full_name || p.email,
            online_at: p.online_at || new Date().toISOString(),
          });
        }
      });
    });
    this.state.onlineUsers = users;
    this.notify();
  }

  private setupLifecycleListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Instantly refresh workspace data when user returns to app / unlocks phone
          this.refreshWorkspaceData();
          this.reconnectRealtimeIfNeeded();
        }
      });
      window.addEventListener('focus', () => {
        this.refreshWorkspaceData();
      });
    }

    if (typeof window !== 'undefined' && !this.syncPollingInterval) {
      // 4.5-second lightweight polling fallback
      this.syncPollingInterval = setInterval(() => {
        if (
          this.state.authStatus === 'authenticated' &&
          this.state.workspaceId &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          !this.state.isSyncing
        ) {
          this.backgroundSync();
        }
      }, 4500);
    }
  }

  public async backgroundSync(): Promise<void> {
    const supabase = getSupabaseClient();
    const workspaceId = this.state.workspaceId;
    if (!supabase || !workspaceId) return;

    try {
      const [tRes, mRes, aRes, nRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
        supabase.from('milestones').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
        supabase.from('activity_log').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
        supabase.from('notifications').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      ]);

      let changed = false;

      if (tRes.data) {
        const serverTasks = tRes.data as Task[];
        const hasTaskDiff =
          serverTasks.length !== this.state.tasks.length ||
          serverTasks.some((st) => {
            const local = this.state.tasks.find((lt) => lt.id === st.id);
            return !local || local.status !== st.status || local.updated_at !== st.updated_at;
          });

        if (hasTaskDiff) {
          this.state.tasks = serverTasks;
          this.recalculateAllMilestoneProgress();
          changed = true;
        }
      }

      if (mRes.data) {
        const serverMilestones = mRes.data as Milestone[];
        const hasMilestoneDiff =
          serverMilestones.length !== this.state.milestones.length ||
          serverMilestones.some((sm) => {
            const local = this.state.milestones.find((lm) => lm.id === sm.id);
            return !local || local.status !== sm.status || local.progress_percentage !== sm.progress_percentage;
          });

        if (hasMilestoneDiff) {
          this.state.milestones = serverMilestones;
          changed = true;
        }
      }

      if (aRes.data) {
        const serverActivity = aRes.data as ActivityLogItem[];
        if (
          serverActivity.length > 0 &&
          (!this.state.activityLog[0] || serverActivity[0].id !== this.state.activityLog[0].id)
        ) {
          this.state.activityLog = serverActivity;
          changed = true;
        }
      }

      if (nRes.data) {
        const serverNotifs = nRes.data as NotificationItem[];
        if (serverNotifs.length !== this.state.notifications.length) {
          this.state.notifications = serverNotifs;
          changed = true;
        }
      }

      if (changed) {
        this.notify();
      }
    } catch {
      // background sync is silent
    }
  }

  private reconnectRealtimeIfNeeded(): void {
    if (!this.state.workspaceId || !isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (
      !this.supabaseSubscription ||
      this.supabaseSubscription.state === 'closed' ||
      this.supabaseSubscription.state === 'errored'
    ) {
      this.setupRealtimeSubscription(this.state.workspaceId);
    }
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

  public async addAllowedEmail(
    email: string,
    role: string = 'Team Member',
    isTeamLead: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      if (!this.state.workspaceId) {
        return { success: false, message: 'No active workspace selected.' };
      }

      const { data: existing } = await supabase
        .from('workspace_members')
        .select('id, status')
        .eq('workspace_id', this.state.workspaceId)
        .ilike('invited_email', clean)
        .limit(1);

      if (existing && existing.length > 0) {
        return {
          success: false,
          message:
            existing[0].status === 'active'
              ? `${clean} is already an active member of this workspace.`
              : `${clean} has already been invited to this workspace.`,
        };
      }

      const { error } = await supabase.from('workspace_members').insert({
        workspace_id: this.state.workspaceId,
        invited_email: clean,
        invited_role: role,
        invited_is_team_lead: isTeamLead,
        status: 'invited',
      });

      if (error) {
        console.warn('Supabase Invite member warning:', error.message);
        return { success: false, message: error.message };
      }
    }

    if (!this.state.allowedEmails.includes(clean)) {
      this.state.allowedEmails = [...this.state.allowedEmails, clean];
    }
    this.logActivity('ALLOWLIST_ADD', 'user', clean, `Invited ${clean} to workspace.`);
    this.notify();
    return { success: true, message: `Invitation saved for ${clean}.` };
  }

  public async removeAllowedEmail(email: string): Promise<void> {
    const clean = email.trim().toLowerCase();
    const supabase = getSupabaseClient();
    if (supabase && this.state.workspaceId) {
      await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', this.state.workspaceId)
        .ilike('invited_email', clean)
        .eq('status', 'invited');
    }
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

    this.broadcastEvent('TASK_MUTATION', {
      action: 'create',
      task: newTask,
      actor: this.state.currentUser.full_name,
      message: `⚡ ${this.state.currentUser.full_name} added task "${newTask.title}"`,
    });

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

    this.broadcastEvent('TASK_MUTATION', {
      action: 'update',
      task: updatedTask,
      actor: this.state.currentUser.full_name,
      message: `⚡ ${this.state.currentUser.full_name} updated task "${updatedTask.title}"`,
    });

    this.notify();
    return { success: true, message: 'Task updated successfully.' };
  }

  public completeTaskWithDetails(
    id: string,
    details: {
      completion_date?: string;
      completion_details?: string;
      completion_document_id?: string;
      completion_document_title?: string;
    }
  ): { success: boolean; message: string; task?: Task } {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return { success: false, message: 'Task not found.' };

    const actor = this.state.currentUser.full_name;
    const completedAt = new Date().toISOString();
    const completionDate = details.completion_date || new Date().toISOString().split('T')[0];

    const updatedTask: Task = {
      ...task,
      status: 'Done',
      completed_at: completedAt,
      completion_date: completionDate,
      completion_details: details.completion_details?.trim() || null,
      completed_by_name: actor,
      completion_document_id: details.completion_document_id || null,
      completion_document_title: details.completion_document_title || null,
      updated_by: this.state.currentUser.email,
      updated_at: completedAt,
    };

    this.state.tasks = this.state.tasks.map((t) => (t.id === id ? updatedTask : t));
    this.recalculateMilestoneProgress(task.milestone_id);

    const docNote = details.completion_document_title
      ? ` with document "${details.completion_document_title}"`
      : '';
    const dateNote = details.completion_date ? ` (Completed on ${details.completion_date})` : '';
    const actionDesc = `${actor} completed task "${task.title}"${dateNote}${docNote}`;

    this.state.recentTaskActions[id] = {
      actor,
      action: 'completed',
      timestamp: Date.now(),
    };

    const activityItem = this.logActivity('STATUS', 'task', id, actionDesc);

    // Notify other team members across the app
    this.notifyTeamMembers(
      'task_completed',
      `Task Completed: ${task.title}`,
      actionDesc,
      this.state.currentUser.email
    );

    // ⚡ INSTANT WEBSOCKET BROADCAST to all devices in <100ms
    this.broadcastEvent('TASK_MUTATION', {
      action: 'complete',
      task: updatedTask,
      actor,
      message: `⚡ ${actionDesc}`,
    });

    if (activityItem) {
      this.broadcastEvent('ACTIVITY_LOG', { item: activityItem });
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('tasks')
        .update({
          status: 'Done',
          completed_at: completedAt,
          completion_date: completionDate,
          completion_details: updatedTask.completion_details,
          completed_by_name: updatedTask.completed_by_name,
          completion_document_id: updatedTask.completion_document_id,
          completion_document_title: updatedTask.completion_document_title,
          updated_by: updatedTask.updated_by,
          updated_at: updatedTask.updated_at,
        })
        .eq('id', id)
        .then();
    }

    this.notify();
    return { success: true, message: actionDesc, task: updatedTask };
  }

  public toggleTaskStatus(
    id: string,
    expectedCurrentStatus?: TaskStatus
  ): { success: boolean; message: string; newStatus?: TaskStatus } {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return { success: false, message: 'Task not found.' };

    const wasDone = task.status === 'Done';
    const newStatus: TaskStatus = wasDone ? 'Todo' : 'Done';

    // Conflict Guard: If caller expected a specific status and it already changed (e.g. reopened on phone 10s ago)
    if (expectedCurrentStatus && task.status !== expectedCurrentStatus) {
      return {
        success: false,
        message: `Task was already ${task.status === 'Done' ? 'completed' : 'reopened'} by ${task.completed_by_name || 'a teammate'}.`,
        newStatus: task.status,
      };
    }

    const completedAt = wasDone ? null : new Date().toISOString();

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      completed_at: completedAt,
      completion_date: wasDone ? null : task.completion_date || new Date().toISOString().split('T')[0],
      completion_details: wasDone ? null : task.completion_details,
      completed_by_name: wasDone ? null : this.state.currentUser.full_name,
      updated_by: this.state.currentUser.email,
      updated_at: new Date().toISOString(),
    };

    this.state.tasks = this.state.tasks.map((t) => (t.id === id ? updatedTask : t));
    this.recalculateMilestoneProgress(task.milestone_id);

    const actor = this.state.currentUser.full_name;
    const actionDesc = wasDone
      ? `${actor} reopened task "${task.title}"`
      : `${actor} marked "${task.title}" as Done`;

    this.state.recentTaskActions[id] = {
      actor,
      action: wasDone ? 'reopened' : 'completed',
      timestamp: Date.now(),
    };

    const activityItem = this.logActivity('STATUS', 'task', id, actionDesc);

    if (!wasDone) {
      this.notifyTeamMembers(
        'task_completed',
        `Task Completed: ${task.title}`,
        `${actor} completed task "${task.title}"`,
        this.state.currentUser.email
      );
    }

    // ⚡ INSTANT WEBSOCKET BROADCAST to all connected devices in <100ms
    this.broadcastEvent('TASK_MUTATION', {
      action: wasDone ? 'reopen' : 'toggle',
      task: updatedTask,
      actor,
      message: `⚡ ${actionDesc}`,
    });

    if (activityItem) {
      this.broadcastEvent('ACTIVITY_LOG', { item: activityItem });
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('tasks')
        .update({
          status: newStatus,
          completed_at: completedAt,
          completion_date: updatedTask.completion_date,
          completion_details: updatedTask.completion_details,
          completed_by_name: updatedTask.completed_by_name,
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

    this.broadcastEvent('TASK_MUTATION', {
      action: 'delete',
      task,
      actor: this.state.currentUser.full_name,
      message: `⚡ ${this.state.currentUser.full_name} deleted task "${task.title}"`,
    });

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

    this.broadcastEvent('TASK_MUTATION', {
      action: 'create',
      task: restoredTask,
      actor: this.state.currentUser.full_name,
      message: `⚡ ${this.state.currentUser.full_name} restored task "${restoredTask.title}"`,
    });

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
  public async addDocument(
    data: Omit<DocumentItem, 'id' | 'uploaded_by' | 'uploaded_by_name' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; message?: string; document?: DocumentItem }> {
    const newDoc: DocumentItem = {
      ...data,
      id: 'doc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      workspace_id: this.state.workspaceId || undefined,
      uploaded_by: this.state.currentUser.email,
      uploaded_by_id: this.state.currentUser.id,
      uploaded_by_name: this.state.currentUser.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      if (!this.state.workspaceId) {
        return { success: false, message: 'No active workspace selected.' };
      }
      const { error } = await supabase
        .from('documents')
        .insert({
          id: newDoc.id,
          workspace_id: this.state.workspaceId,
          title: newDoc.title,
          description: newDoc.description,
          category: newDoc.category,
          tags: newDoc.tags,
          file_url: newDoc.file_url,
          file_name: newDoc.file_name,
          file_size: newDoc.file_size,
          file_type: newDoc.file_type,
          attachments: newDoc.attachments || [],
          is_external_link: newDoc.is_external_link,
          milestone_id: newDoc.milestone_id || null,
          uploaded_by: newDoc.uploaded_by,
          uploaded_by_id: this.state.currentUser.id,
          uploaded_by_name: newDoc.uploaded_by_name,
        });

      if (error) {
        this.handleDbError(error, 'Add document');
        return { success: false, message: error.message };
      }
    }

    this.state.documents = [newDoc, ...this.state.documents.filter((d) => d.id !== newDoc.id)];
    this.logActivity('UPLOAD', 'document', newDoc.id, `${this.state.currentUser.full_name} uploaded document "${newDoc.title}".`);
    this.notify();
    return { success: true, document: newDoc };
  }

  public async updateDocument(
    id: string,
    updates: Partial<DocumentItem>
  ): Promise<{ success: boolean; message: string }> {
    const existing = this.state.documents.find((d) => d.id === id);
    if (!existing) return { success: false, message: 'Document not found.' };

    const isUploader =
      existing.uploaded_by.toLowerCase() === this.state.currentUser.email.toLowerCase();
    if (!isUploader && !this.isCurrentUserTeamLead()) {
      return {
        success: false,
        message: 'Permission denied: Only the uploader or Team Lead can edit this document.',
      };
    }

    const updated: DocumentItem = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('documents')
        .update({
          title: updated.title,
          description: updated.description,
          category: updated.category,
          tags: updated.tags,
          file_url: updated.file_url,
          file_name: updated.file_name,
          file_size: updated.file_size,
          file_type: updated.file_type,
          attachments: updated.attachments || [],
          is_external_link: updated.is_external_link,
          milestone_id: updated.milestone_id || null,
          updated_at: updated.updated_at,
        })
        .eq('id', id);

      if (error) {
        this.handleDbError(error, 'Update document');
        return { success: false, message: error.message };
      }
    }

    this.state.documents = this.state.documents.map((d) => (d.id === id ? updated : d));
    this.logActivity(
      'UPDATE',
      'document',
      id,
      `${this.state.currentUser.full_name} updated document "${updated.title}".`
    );
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

  public notifyTeamMembers(
    type: NotificationItem['type'],
    title: string,
    message: string,
    excludeEmail?: string
  ): void {
    const recipients = this.state.teamMembers.length > 0 ? this.state.teamMembers : SEED_MEMBERS;
    recipients.forEach((m) => {
      if (excludeEmail && m.email.toLowerCase() === excludeEmail.toLowerCase()) return;
      this.createNotification(type, title, message, m.email);
    });
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

    // If notification is for current user, trigger native browser notification if permitted
    if (email.toLowerCase() === this.state.currentUser.email.toLowerCase()) {
      playNotificationChime();
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, {
            body: message,
            icon: '/favicon.ico',
          });
        } catch {
          // Ignore native notification errors
        }
      }
    }

    this.state.notifications = [notif, ...this.state.notifications].slice(0, 50);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.from('notifications').insert(notif).then();
    }

    this.notify();
  }

  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
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
  ): ActivityLogItem {
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

    return item;
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
