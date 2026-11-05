import { useSyncExternalStore } from 'react';
import { realtimeStore } from '../lib/realtimeStore';

export function useRealtimeStore() {
  const state = useSyncExternalStore(
    (callback) => realtimeStore.subscribe(callback),
    () => realtimeStore.getState(),
    () => realtimeStore.getState()
  );

  return {
    state,
    authStatus: state.authStatus,
    authError: state.authError,
    dbError: state.dbError,
    workspace: state.workspace,
    teamMembers: state.teamMembers,
    currentUser: state.currentUser,
    milestones: state.milestones,
    tasks: state.tasks,
    meetings: state.meetings,
    documents: state.documents,
    notifications: state.notifications,
    activityLog: state.activityLog,
    deletedTaskUndoStack: state.deletedTaskUndoStack,
    isRealtimeConnected: state.isRealtimeConnected,
    isSyncing: state.isSyncing,
    lastSyncTime: state.lastSyncTime,
    allowedEmails: state.allowedEmails,
    isTeamLead: realtimeStore.isCurrentUserTeamLead(),

    // Actions
    signInWithPassword: realtimeStore.signInWithPassword.bind(realtimeStore),
    signOut: realtimeStore.signOut.bind(realtimeStore),
    clearDbError: realtimeStore.clearDbError.bind(realtimeStore),
    retrySync: realtimeStore.refreshWorkspaceData.bind(realtimeStore),
    updateMemberProfile: realtimeStore.updateMemberProfile.bind(realtimeStore),
    setCurrentUser: realtimeStore.setCurrentUser.bind(realtimeStore),
    activateInvitedAccount: realtimeStore.activateInvitedAccount.bind(realtimeStore),
    loginWithEmail: realtimeStore.loginWithEmail.bind(realtimeStore),
    addAllowedEmail: realtimeStore.addAllowedEmail.bind(realtimeStore),
    generateActivationCodeForInvite:
      realtimeStore.generateActivationCodeForInvite.bind(realtimeStore),
    removeAllowedEmail: realtimeStore.removeAllowedEmail.bind(realtimeStore),
    addMilestone: realtimeStore.addMilestone.bind(realtimeStore),
    updateMilestone: realtimeStore.updateMilestone.bind(realtimeStore),
    reorderMilestones: realtimeStore.reorderMilestones.bind(realtimeStore),
    archiveMilestone: realtimeStore.archiveMilestone.bind(realtimeStore),
    duplicateMilestone: realtimeStore.duplicateMilestone.bind(realtimeStore),
    deleteMilestone: realtimeStore.deleteMilestone.bind(realtimeStore),
    addTask: realtimeStore.addTask.bind(realtimeStore),
    updateTask: realtimeStore.updateTask.bind(realtimeStore),
    toggleTaskStatus: realtimeStore.toggleTaskStatus.bind(realtimeStore),
    deleteTask: realtimeStore.deleteTask.bind(realtimeStore),
    undoDeleteTask: realtimeStore.undoDeleteTask.bind(realtimeStore),
    bulkUpdateTasks: realtimeStore.bulkUpdateTasks.bind(realtimeStore),
    addTaskComment: realtimeStore.addTaskComment.bind(realtimeStore),
    addMeeting: realtimeStore.addMeeting.bind(realtimeStore),
    updateMeeting: realtimeStore.updateMeeting.bind(realtimeStore),
    deleteMeeting: realtimeStore.deleteMeeting.bind(realtimeStore),
    convertActionItemToTask: realtimeStore.convertActionItemToTask.bind(realtimeStore),
    addDocument: realtimeStore.addDocument.bind(realtimeStore),
    updateDocument: realtimeStore.updateDocument.bind(realtimeStore),
    deleteDocument: realtimeStore.deleteDocument.bind(realtimeStore),
    markNotificationAsRead: realtimeStore.markNotificationAsRead.bind(realtimeStore),
    markAllNotificationsAsRead: realtimeStore.markAllNotificationsAsRead.bind(realtimeStore),
    clearAllNotifications: realtimeStore.clearAllNotifications.bind(realtimeStore),
    resetToFactorySeed: realtimeStore.resetToFactorySeed.bind(realtimeStore),
    reconnectSupabase: realtimeStore.initSupabaseRealtime.bind(realtimeStore),
  };
}
