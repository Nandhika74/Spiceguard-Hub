import { getSupabaseClient } from './supabase';
import {
  Milestone,
  Task,
  Meeting,
  DocumentItem,
  NotificationItem,
  ActivityLogItem,
  Profile,
} from '../types';

export interface TableMigrationStats {
  inserted: number;
  skipped: number;
  failed: number;
  unmapped: number;
}

export interface MigrationReport {
  dryRun: boolean;
  workspaceId: string;
  timestamp: string;
  tables: Record<string, TableMigrationStats>;
  unmappedUsers: string[];
  errors: string[];
}

const STORAGE_PREFIX = 'spiceguard_hub_v3_';

function readLocalKey<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function isValidUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Safely previews or executes a one-time migration from localStorage (spiceguard_hub_v3_*)
 * into Supabase for the given workspace UUID.
 * - Never deletes or overwrites localStorage.
 * - Preserves all existing TEXT IDs and timestamps.
 * - Maps human-readable user names/emails to existing profile UUIDs without inventing UUIDs.
 */
export async function runLocalStorageMigration(
  workspaceId: string,
  options: { dryRun?: boolean } = { dryRun: true }
): Promise<MigrationReport> {
  const dryRun = options.dryRun ?? true;
  const cleanWorkspaceId = workspaceId.trim();

  const report: MigrationReport = {
    dryRun,
    workspaceId: cleanWorkspaceId,
    timestamp: new Date().toISOString(),
    tables: {
      milestones: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      milestone_date_history: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      tasks: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      task_comments: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      meetings: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      meeting_action_items: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      documents: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      notifications: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
      activity_log: { inserted: 0, skipped: 0, failed: 0, unmapped: 0 },
    },
    unmappedUsers: [],
    errors: [],
  };

  if (!isValidUuid(cleanWorkspaceId)) {
    report.errors.push('Invalid workspace UUID format.');
    return report;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    report.errors.push('Supabase client is not configured.');
    return report;
  }

  // Load workspace profiles to map names/emails -> profile UUIDs
  const { data: profilesData, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, email, full_name');

  if (profilesErr) {
    report.errors.push(`Failed to load profiles: ${profilesErr.message}`);
    return report;
  }

  const profiles = (profilesData || []) as Pick<Profile, 'id' | 'email' | 'full_name'>[];
  const unmappedSet = new Set<string>();

  const resolveUserId = (identifier?: string | null): string | null => {
    if (!identifier) return null;
    const norm = identifier.trim().toLowerCase();
    const match = profiles.find(
      (p) => p.email.toLowerCase() === norm || p.full_name.toLowerCase() === norm
    );
    if (!match) {
      unmappedSet.add(identifier);
      return null;
    }
    return match.id;
  };

  // Read localStorage data
  const milestones = readLocalKey<Milestone[]>('milestones', []);
  const tasks = readLocalKey<Task[]>('tasks', []);
  const meetings = readLocalKey<Meeting[]>('meetings', []);
  const documents = readLocalKey<DocumentItem[]>('documents', []);
  const notifications = readLocalKey<NotificationItem[]>('notifications', []);
  const activityLog = readLocalKey<ActivityLogItem[]>('activity_log', []);

  // Prepare normalized payloads
  const milestoneRows = milestones.map(({ date_history, ...m }) => {
    const createdById = resolveUserId(m.created_by);
    const updatedById = resolveUserId(m.updated_by);
    if ((m.created_by && !createdById) || (m.updated_by && !updatedById)) {
      report.tables.milestones.unmapped++;
    }
    return {
      ...m,
      workspace_id: cleanWorkspaceId,
      created_by_id: createdById,
      updated_by_id: updatedById,
    };
  });

  const historyRows = milestones.flatMap((m) =>
    (m.date_history || []).map((h) => {
      const changedById = resolveUserId(h.changed_by);
      if (h.changed_by && !changedById) {
        report.tables.milestone_date_history.unmapped++;
      }
      return {
        ...h,
        workspace_id: cleanWorkspaceId,
        milestone_id: m.id,
        changed_by_id: changedById,
      };
    })
  );

  const taskRows = tasks.map(({ comments, ...t }) => {
    const createdById = resolveUserId(t.created_by);
    const updatedById = resolveUserId(t.updated_by);
    if ((t.created_by && !createdById) || (t.updated_by && !updatedById)) {
      report.tables.tasks.unmapped++;
    }
    return {
      ...t,
      workspace_id: cleanWorkspaceId,
      created_by_id: createdById,
      updated_by_id: updatedById,
    };
  });

  const commentRows = tasks.flatMap((t) =>
    (t.comments || []).map((c) => {
      const userUuid = resolveUserId(c.user_id) || resolveUserId(c.user_name);
      if (!userUuid) {
        report.tables.task_comments.unmapped++;
      }
      return {
        ...c,
        workspace_id: cleanWorkspaceId,
        task_id: t.id,
        user_uuid: userUuid,
      };
    })
  );

  const meetingRows = meetings.map(({ action_items, ...mt }) => {
    const createdById = resolveUserId(mt.created_by) || resolveUserId(mt.created_by_name);
    if (!createdById) {
      report.tables.meetings.unmapped++;
    }
    return {
      ...mt,
      workspace_id: cleanWorkspaceId,
      created_by_id: createdById,
    };
  });

  const actionItemRows = meetings.flatMap((mt) =>
    (mt.action_items || []).map((ai) => ({
      ...ai,
      workspace_id: cleanWorkspaceId,
      meeting_id: mt.id,
    }))
  );

  const documentRows = documents.map((d) => {
    const uploadedById = resolveUserId(d.uploaded_by) || resolveUserId(d.uploaded_by_name);
    if (!uploadedById) {
      report.tables.documents.unmapped++;
    }
    return {
      ...d,
      workspace_id: cleanWorkspaceId,
      uploaded_by_id: uploadedById,
    };
  });

  const notificationRows = notifications.map((n) => {
    const userId = resolveUserId(n.user_email);
    if (!userId) {
      report.tables.notifications.unmapped++;
    }
    return {
      ...n,
      workspace_id: cleanWorkspaceId,
      user_id: userId,
    };
  });

  const activityRows = activityLog.map((a) => {
    const actorId = resolveUserId(a.actor_name);
    if (!actorId) {
      report.tables.activity_log.unmapped++;
    }
    return {
      ...a,
      workspace_id: cleanWorkspaceId,
      actor_id: actorId,
    };
  });

  report.unmappedUsers = Array.from(unmappedSet);

  const batches: Array<{ table: string; rows: any[] }> = [
    { table: 'milestones', rows: milestoneRows },
    { table: 'milestone_date_history', rows: historyRows },
    { table: 'tasks', rows: taskRows },
    { table: 'task_comments', rows: commentRows },
    { table: 'meetings', rows: meetingRows },
    { table: 'meeting_action_items', rows: actionItemRows },
    { table: 'documents', rows: documentRows },
    { table: 'notifications', rows: notificationRows },
    { table: 'activity_log', rows: activityRows },
  ];

  if (dryRun) {
    for (const b of batches) {
      report.tables[b.table].inserted = b.rows.length;
    }
    return report;
  }

  // Execute batched upserts with ignoreDuplicates: true
  const CHUNK_SIZE = 50;
  for (const { table, rows } of batches) {
    if (rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true })
        .select('id');

      if (error) {
        report.tables[table].failed += chunk.length;
        report.errors.push(`${table}: ${error.message}`);
      } else {
        const insertedCount = data ? data.length : 0;
        report.tables[table].inserted += insertedCount;
        report.tables[table].skipped += chunk.length - insertedCount;
      }
    }
  }

  return report;
}
