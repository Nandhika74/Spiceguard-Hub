# 🌿 SpiceGuard Hub — Plant Lipids 6-Month PoC Tracker

Real-time, mobile-first team project tracker built for the 4-person SpiceGuard startup team running a 6-month Proof of Concept with **Plant Lipids**.

## ✨ Features
- **Real-Time Synchronisation**: Every task, milestone, meeting, comment, and document syncs live across phones and laptops without refreshing.
- **Invite-Only Security**: Strict allowlist enforced at the database level (`allowed_emails` table). Only authorized team members can sign up or log in.
- **Role-Based Permissions**:
  - All 4 members can add/edit milestones, tasks, meetings, and documents.
  - Only the **Team Lead** (`Nithyasree M`) can delete milestones.
  - Task deletion is restricted to the creator or Team Lead, protected with a 10-second "Undo" toast.
  - Meetings and documents can only be deleted/edited by their creator or Team Lead.
- **Milestone Management & Date Tracking**:
  - Live progress % auto-calculated from completed tasks.
  - Reordering (drag-and-drop / touch handles).
  - Date changes prompt for a reason, preserve the original planned date, show a "Rescheduled" badge, and record entries in `milestone_date_history`.
  - Archive/restore capability.
  - Duplicate milestone with its tasks.
- **Tasks & Kanban / Timeline**:
  - List view, Kanban board with drag-and-drop status columns, and interactive Timeline/Gantt view.
  - Inline editing, task reassignment, milestone transfers, priority badges, and overdue warnings (due within 3 days = amber, overdue = red).
  - Rich task comments with timestamp and author role badge.
  - Deadline validation warning if task deadline exceeds milestone planned date.
- **Meetings & Inference Recorder**:
  - Record agendas, rich text notes, key decisions, and critical inferences/learnings.
  - Action items with one-click conversion to tasks inside any milestone.
  - File attachments and guest attendees.
- **Research & Documents Hub**:
  - File uploads (PDF, DOCX, XLSX, CSV, PPTX, images, .ipynb up to 25 MB) to Supabase Storage.
  - External links, categories, tags, and built-in preview modal.
- **Team Dashboard & Activity Log**:
  - PoC completion %, countdown to final milestone, upcoming 14-day deadlines, overdue alerts, and live activity feed.
- **PWA Ready**: Installable on iOS/Android home screens and desktops with offline status indicator.

---

## 👥 Seed Members
| Name | Role | Email |
| :--- | :--- | :--- |
| **Nithyasree M** | Team Lead & ML Developer | `nithyasree@spiceguard.ai` |
| **Nandhika S** | ML Engineer | `nandhikas3@gmail.com` |
| **Sivakumaran S** | Biotech Researcher | `sivakumaran@spiceguard.ai` |
| **Abhijith Sriram V** | IoT Engineer | `abhijith@spiceguard.ai` |

---

## 🚀 Step-by-Step Setup Guide

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Under **Project Settings** -> **API**, copy your:
   - **Project URL** (`https://xyzcompany.supabase.co`)
   - **anon / public key** (`eyJhbG...`)

### 2. Run the SQL Script
1. In the Supabase Dashboard, open the **SQL Editor**.
2. Click **New Query**, copy the entire contents of `supabase-schema.sql`, paste it, and click **Run**.
3. This creates:
   - All 11 tables (`allowed_emails`, `profiles`, `milestones`, `milestone_date_history`, `tasks`, `task_comments`, `meetings`, `meeting_action_items`, `documents`, `notifications`, `activity_log`).
   - Row Level Security (RLS) policies and helper functions.
   - Triggers for automatic milestone progress % calculation, date history logging, and completion timestamps.
   - Storage bucket `spiceguard-docs` with upload/download policies.
   - Realtime publication subscriptions on all core tables.
   - Pre-loaded 6-month PoC seed milestones and tasks.

### 3. Add or Modify Allowed Emails
To add additional team members or customize emails, run this in the Supabase SQL Editor:
```sql
INSERT INTO public.allowed_emails (email, full_name, role, is_team_lead, avatar_color)
VALUES ('your-email@example.com', 'Your Name', 'Your Role', FALSE, '#14532D')
ON CONFLICT (email) DO NOTHING;
```

### 4. Configure Environment Variables
Set the following in `.env` (or in Vercel / Netlify environment settings):
```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### 5. Deploy to Vercel or Netlify
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the project settings.
