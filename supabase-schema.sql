-- ============================================================================
-- SPICEGUARD HUB - SUPABASE SQL SCHEMA & SEED DATA
-- Plant Lipids 6-Month Proof of Concept Tracker
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ALLOWED EMAILS (Invite-only enforcement)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_team_lead BOOLEAN DEFAULT FALSE,
  avatar_color TEXT NOT NULL DEFAULT '#14532D',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed allowed emails
INSERT INTO public.allowed_emails (email, full_name, role, is_team_lead, avatar_color)
VALUES 
  ('nandhikas3@gmail.com', 'Nandhika S', 'ML Engineer', FALSE, '#247348'),
  ('nithyasree2410841@ssn.edu.in', 'Nithyasree M', 'Team Lead & ML Developer', TRUE, '#14422B'),
  ('sivakumarans.bbt24@rathinam.in', 'Sivakumaran S', 'Biotech Researcher', FALSE, '#D97706'),
  ('abhijithsriram2410202@ssn.edu.in', 'Abhijith Sriram V', 'IoT Engineer', FALSE, '#1E655B'),
  ('nahypin17@gmail.com', 'Collaborator', 'Contributor', FALSE, '#164E33'),
  ('roopavathik@ssnifound.in', 'Roopavathi K', 'Mentor / SSN', FALSE, '#164E33')
ON CONFLICT (email) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_team_lead = EXCLUDED.is_team_lead,
    avatar_color = EXCLUDED.avatar_color;

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked with Auth)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#14532D',
  is_team_lead BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function and trigger to enforce allowlist on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  allowed_record RECORD;
BEGIN
  SELECT * INTO allowed_record FROM public.allowed_emails WHERE LOWER(email) = LOWER(NEW.email);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access Denied: % is not in the SpiceGuard allowlist.', NEW.email;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, avatar_color, is_team_lead)
  VALUES (
    NEW.id,
    NEW.email,
    allowed_record.full_name,
    allowed_record.role,
    allowed_record.avatar_color,
    allowed_record.is_team_lead
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. MILESTONES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT UNIQUE NOT NULL,
  description TEXT,
  planned_date DATE NOT NULL,
  original_planned_date DATE NOT NULL,
  actual_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Blocked', 'Done')),
  progress_percentage NUMERIC DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  support_required TEXT,
  notes TEXT,
  phase_label TEXT,
  sort_order INT DEFAULT 0,
  archived BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. MILESTONE DATE HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestone_date_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  old_date DATE NOT NULL,
  new_date DATE NOT NULL,
  reason TEXT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. TASKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_id TEXT,
  assignee_name TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'Todo' CHECK (status IN ('Todo', 'In Progress', 'Blocked', 'Done')),
  priority TEXT NOT NULL DEFAULT 'Med' CHECK (priority IN ('Low', 'Med', 'High')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. TASK COMMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT,
  user_color TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. MEETINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Internal review', 'Mentor meeting', 'Plant Lipids', 'Other')),
  attendees JSONB DEFAULT '[]'::jsonb,
  guest_attendees TEXT,
  agenda TEXT,
  notes TEXT,
  key_decisions TEXT,
  inferences_learnings TEXT,
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. MEETING ACTION ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  assignee TEXT,
  due_date DATE,
  converted_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. DOCUMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Model/ML', 'Hardware/Sensors', 'Biotech', 'Plant Lipids data', 'Pitch/Reports', 'Other')),
  tags TEXT[] DEFAULT '{}',
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  is_external_link BOOLEAN DEFAULT FALSE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. ACTIVITY LOG TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. TRIGGERS & BUSINESS LOGIC
-- ----------------------------------------------------------------------------

-- Trigger to recalculate milestone progress & completion date when tasks change
CREATE OR REPLACE FUNCTION public.recalculate_milestone_progress()
RETURNS TRIGGER AS $$
DECLARE
  target_milestone_id UUID;
  total_tasks INT;
  done_tasks INT;
  new_progress NUMERIC;
  new_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_milestone_id := OLD.milestone_id;
  ELSE
    target_milestone_id := NEW.milestone_id;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'Done')
  INTO total_tasks, done_tasks
  FROM public.tasks
  WHERE milestone_id = target_milestone_id;

  IF total_tasks = 0 THEN
    new_progress := 0;
    new_status := 'Not Started';
  ELSE
    new_progress := ROUND((done_tasks::numeric / total_tasks::numeric) * 100, 1);
    IF new_progress = 100 THEN
      new_status := 'Done';
    ELSIF done_tasks > 0 THEN
      new_status := 'In Progress';
    ELSE
      new_status := 'Not Started';
    END IF;
  END IF;

  UPDATE public.milestones
  SET progress_percentage = new_progress,
      status = CASE WHEN new_progress = 100 THEN 'Done' ELSE status END,
      actual_completion_date = CASE WHEN new_progress = 100 THEN CURRENT_DATE ELSE NULL END,
      updated_at = NOW()
  WHERE id = target_milestone_id;

  -- Also update previous milestone if task was moved across milestones
  IF TG_OP = 'UPDATE' AND OLD.milestone_id IS DISTINCT FROM NEW.milestone_id THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'Done')
    INTO total_tasks, done_tasks
    FROM public.tasks
    WHERE milestone_id = OLD.milestone_id;

    IF total_tasks = 0 THEN
      new_progress := 0;
    ELSE
      new_progress := ROUND((done_tasks::numeric / total_tasks::numeric) * 100, 1);
    END IF;

    UPDATE public.milestones
    SET progress_percentage = new_progress,
        updated_at = NOW()
    WHERE id = OLD.milestone_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalculate_milestone ON public.tasks;
CREATE TRIGGER trg_recalculate_milestone
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_milestone_progress();

-- Auto-fill task completed_at
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Done' AND (OLD.status IS DISTINCT FROM 'Done' OR NEW.completed_at IS NULL) THEN
    NEW.completed_at := NOW();
  ELSIF NEW.status != 'Done' THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_completion ON public.tasks;
CREATE TRIGGER trg_task_completion
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_completion();

-- Date history tracker on milestone planned_date change
CREATE OR REPLACE FUNCTION public.track_milestone_date_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.planned_date IS DISTINCT FROM NEW.planned_date THEN
    INSERT INTO public.milestone_date_history (
      milestone_id,
      old_date,
      new_date,
      reason,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.planned_date,
      NEW.planned_date,
      COALESCE(NEW.notes, 'Rescheduled milestone'),
      COALESCE(NEW.updated_by, 'Team Member')
    );
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_track_milestone_date ON public.milestones;
CREATE TRIGGER trg_track_milestone_date
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.track_milestone_date_change();

-- ----------------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_date_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function: Is current user an allowed member?
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails 
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Is current user Team Lead?
CREATE OR REPLACE FUNCTION public.is_team_lead()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails 
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND is_team_lead = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for allowed_emails
CREATE POLICY "Allow members to read allowed emails" ON public.allowed_emails
  FOR SELECT TO authenticated USING (public.is_member());

-- Policies for profiles
CREATE POLICY "Allow members to read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Allow users to update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Policies for milestones (All 4 members add/edit, Team Lead deletes)
CREATE POLICY "Members can view milestones" ON public.milestones
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert milestones" ON public.milestones
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Members can update milestones" ON public.milestones
  FOR UPDATE TO authenticated USING (public.is_member());
CREATE POLICY "Only Team Lead can delete milestones" ON public.milestones
  FOR DELETE TO authenticated USING (public.is_team_lead());

-- Policies for milestone_date_history
CREATE POLICY "Members can view date history" ON public.milestone_date_history
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert date history" ON public.milestone_date_history
  FOR INSERT TO authenticated WITH CHECK (public.is_member());

-- Policies for tasks
CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Members can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (public.is_member());
CREATE POLICY "Task creator or Team Lead can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (
    public.is_team_lead() OR created_by = (auth.jwt() ->> 'email')
  );

-- Policies for task_comments
CREATE POLICY "Members can view comments" ON public.task_comments
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert comments" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (public.is_member());

-- Policies for meetings
CREATE POLICY "Members can view meetings" ON public.meetings
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Meeting creator or Team Lead can update meetings" ON public.meetings
  FOR UPDATE TO authenticated USING (
    public.is_team_lead() OR created_by = (auth.jwt() ->> 'email')
  );
CREATE POLICY "Meeting creator or Team Lead can delete meetings" ON public.meetings
  FOR DELETE TO authenticated USING (
    public.is_team_lead() OR created_by = (auth.jwt() ->> 'email')
  );

-- Policies for meeting_action_items
CREATE POLICY "Members can view meeting action items" ON public.meeting_action_items
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can manage meeting action items" ON public.meeting_action_items
  FOR ALL TO authenticated USING (public.is_member());

-- Policies for documents
CREATE POLICY "Members can view documents" ON public.documents
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Uploader or Team Lead can update documents" ON public.documents
  FOR UPDATE TO authenticated USING (
    public.is_team_lead() OR uploaded_by = (auth.jwt() ->> 'email')
  );
CREATE POLICY "Uploader or Team Lead can delete documents" ON public.documents
  FOR DELETE TO authenticated USING (
    public.is_team_lead() OR uploaded_by = (auth.jwt() ->> 'email')
  );

-- Policies for notifications
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL TO authenticated USING (
    LOWER(user_email) = LOWER(auth.jwt() ->> 'email')
  );

-- Policies for activity_log
CREATE POLICY "Members can view activity log" ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert activity log" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (public.is_member());

-- ----------------------------------------------------------------------------
-- 14. REALTIME REPLICATION ENABLEMENT
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_action_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

-- ----------------------------------------------------------------------------
-- 15. STORAGE BUCKET (Documents & Attachments)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spiceguard-docs',
  'spiceguard-docs',
  true,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/x-ipynb+json',
    'application/json'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'spiceguard-docs');

CREATE POLICY "Members upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'spiceguard-docs');

CREATE POLICY "Uploader or Lead delete documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'spiceguard-docs');

-- ----------------------------------------------------------------------------
-- 16. PRE-LOAD SEED DATA (6 Months PoC with Plant Lipids)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  m1_id UUID := gen_random_uuid();
  m2_id UUID := gen_random_uuid();
  m3_id UUID := gen_random_uuid();
  m4_id UUID := gen_random_uuid();
  m5_id UUID := gen_random_uuid();
  m6_id UUID := gen_random_uuid();
BEGIN
  -- Month 1
  INSERT INTO public.milestones (id, title, description, planned_date, original_planned_date, status, progress_percentage, support_required, notes, phase_label, sort_order)
  VALUES (
    m1_id,
    'Month 1 – Ground reality, data availability & lab setup',
    'Audit spice storage conditions, sensor feasibility and kick off lab ML datasets for curcumin and adulterant detection.',
    '2026-10-31',
    '2026-10-31',
    'Not Started',
    0,
    'Plant Lipids QA team access for benchmark spice samples & calibration data.',
    'Initial grounding phase. Focus on high-signal curcumin quality sensors and spectrum tests.',
    'Month 1',
    1
  );

  INSERT INTO public.tasks (milestone_id, title, assignee_id, assignee_name, deadline, status, priority, notes)
  VALUES 
    (m1_id, 'Dataset ready for Model 1', 'nandhikas3@gmail.com', 'Nandhika S', '2026-10-25', 'Todo', 'High', 'Clean spectral and chemical markers for turmeric model 1.'),
    (m1_id, 'Sensor architecture finalised', 'abhijith@spiceguard.ai', 'Abhijith Sriram V', '2026-10-28', 'Todo', 'High', 'Select low-power optical & gas sensors suitable for warehouse pods.'),
    (m1_id, 'Data collection started for Model 2', 'nithyasree@spiceguard.ai', 'Nithyasree M', '2026-10-31', 'Todo', 'Med', 'Secondary dataset setup for cross-spice validation.');

  -- Month 2
  INSERT INTO public.milestones (id, title, description, planned_date, original_planned_date, status, progress_percentage, support_required, notes, phase_label, sort_order)
  VALUES (
    m2_id,
    'Month 2 – Model evaluation & lab testing',
    'Run benchmark lab tests with synthetic spoilage & adulteration samples, fine-tune Model 1 parameters.',
    '2026-11-25',
    '2026-11-25',
    'Not Started',
    0,
    'Plant Lipids lab equipment access and HPLC validation cross-checks.',
    'Benchmarking against certified HPLC results.',
    'Month 2',
    2
  );

  INSERT INTO public.tasks (milestone_id, title, assignee_id, assignee_name, deadline, status, priority, notes)
  VALUES 
    (m2_id, 'Fine-tune Model 1', 'nandhikas3@gmail.com', 'Nandhika S', '2026-11-15', 'Todo', 'High', 'Train on extended hyper-spectral curve data.'),
    (m2_id, 'Lab sensor setup done', 'abhijith@spiceguard.ai', 'Abhijith Sriram V', '2026-11-15', 'Todo', 'Med', 'Test sensor rig under humidity and temperature fluctuations.'),
    (m2_id, 'Model 2 factor validation done', 'sivakumaran@spiceguard.ai', 'Sivakumaran S', '2026-11-25', 'Todo', 'Med', 'Validate biochemical factors and volatile compound correlation.');

  -- Month 3
  INSERT INTO public.milestones (id, title, description, planned_date, original_planned_date, status, progress_percentage, support_required, notes, phase_label, sort_order)
  VALUES (
    m3_id,
    'Month 3 – Pilot at Plant Lipids warehouse',
    'First live warehouse deployment of edge sensory pods and real-time inference pipeline at Plant Lipids.',
    '2026-12-20',
    '2026-12-20',
    'Not Started',
    0,
    'Warehouse physical access, Wi-Fi/mesh node clearance and safety approvals.',
    'Pilot location: Cochin / Kolenchery extraction warehouse facility.',
    'Month 3',
    3
  );

  INSERT INTO public.tasks (milestone_id, title, assignee_id, assignee_name, deadline, status, priority, notes)
  VALUES 
    (m3_id, 'Sensor placement at warehouse', 'abhijith@spiceguard.ai', 'Abhijith Sriram V', '2026-12-05', 'Todo', 'High', 'Deploy 12 edge sensory nodes across raw spice storage bays.'),
    (m3_id, 'Real-world model performance validation', 'nithyasree@spiceguard.ai', 'Nithyasree M', '2026-12-20', 'Todo', 'High', 'Compare live sensor predictions with lab ground-truth samples.'),
    (m3_id, 'Dashboard for viewing analytics built', 'nandhikas3@gmail.com', 'Nandhika S', '2026-12-20', 'Todo', 'Med', 'Plant Lipids supervisor dashboard with live heatmaps and telemetry.');

  -- Month 4
  INSERT INTO public.milestones (id, title, description, planned_date, original_planned_date, status, progress_percentage, support_required, notes, phase_label, sort_order)
  VALUES (
    m4_id,
    'Month 4 – Scale turmeric warehouses, other spice models',
    'Scale edge monitoring across additional turmeric silos, start expanding model architecture to pepper and chili.',
    '2027-01-31',
    '2027-01-31',
    'Not Started',
    0,
    'Additional spice samples (Black pepper, Chili oleoresin raw batches).',
    'Expanding from single spice to multi-spice oleoresin raw material protection.',
    'Month 4',
    4
  );

  INSERT INTO public.tasks (milestone_id, title, assignee_id, assignee_name, deadline, status, priority, notes)
  VALUES 
    (m4_id, 'Constant improvement of models with feedback loop', 'nandhikas3@gmail.com', 'Nandhika S', '2027-01-15', 'Todo', 'Med', 'Integrate false-positive telemetry into continuous retraining.'),
    (m4_id, 'Build models for other spices with factor validation', 'sivakumaran@spiceguard.ai', 'Sivakumaran S', '2027-01-31', 'Todo', 'High', 'Piperine decay and capsaicin stability factors.');

  -- Month 5
  INSERT INTO public.milestones (id, title, description, planned_date, original_planned_date, status, progress_percentage, support_required, notes, phase_label, sort_order)
  VALUES (
    m5_id,
    'Month 5 – Pilot of other spice models & role-based dashboard',
    'Evaluate secondary spice models live, deploy role-based security access for warehouse managers and quality teams.',
    '2027-02-25',
    '2027-02-25',
    'Not Started',
    0,
    'Cross-functional review with Plant Lipids QA & Supply Chain heads.',
    'Operational rollout for floor supervisors.',
    'Month 5',
    5
  );

  INSERT INTO public.tasks (milestone_id, title, assignee_id, assignee_name, deadline, status, priority, notes)
  VALUES 
    (m5_id, 'Model evaluation', 'nithyasree@spiceguard.ai', 'Nithyasree M', '2027-02-10', 'Todo', 'High', 'Benchmark multi-spice inference accuracy against chemical tests.'),
    (m5_id, 'Performance monitoring and fine-tuning for other models', 'nandhikas3@gmail.com', 'Nandhika S', '2027-02-25', 'Todo', 'Med', 'Edge device inference latency optimization < 200ms.'),
    (m5_id, 'Role-based dashboard with model integration', 'abhijith@spiceguard.ai', 'Abhijith Sriram V', '2027-02-25', 'Todo', 'Med', 'RBAC UI for Plant Lipids executives and floor operators.');

  -- Month 6
  INSERT INTO public.milestones (id, title, description, planned_date, original_planned_date, status, progress_percentage, support_required, notes, phase_label, sort_order)
  VALUES (
    m6_id,
    'Month 6 – Scale to larger warehouse area & reports',
    'Complete final Proof of Concept phase, generate economic cost-reduction audit, and hand over deployment report.',
    '2027-03-15',
    '2027-03-15',
    'Not Started',
    0,
    'Sign-off meeting with Plant Lipids executive committee.',
    'Final PoC evaluation for commercial production contract.',
    'Month 6',
    6
  );

  INSERT INTO public.tasks (milestone_id, title, assignee_id, assignee_name, deadline, status, priority, notes)
  VALUES 
    (m6_id, 'Implementation report', 'nithyasree@spiceguard.ai', 'Nithyasree M', '2027-03-05', 'Todo', 'High', 'Comprehensive technical architecture and operational playbook.'),
    (m6_id, 'Analysis report', 'nandhikas3@gmail.com', 'Nandhika S', '2027-03-10', 'Todo', 'High', 'Statistical analysis of spoilage detection accuracy and latency.'),
    (m6_id, 'Cost reduction tracking report', 'sivakumaran@spiceguard.ai', 'Sivakumaran S', '2027-03-15', 'Todo', 'High', 'Estimated savings from early batch degradation prevention.');

  -- Seed initial activity log
  INSERT INTO public.activity_log (actor_name, action, entity_type, entity_id, details)
  VALUES 
    ('System', 'INITIALIZE', 'milestone', m1_id::text, 'SpiceGuard Hub PoC with Plant Lipids initialized with 6 milestones.'),
    ('Nithyasree M', 'SETUP', 'milestone', m1_id::text, 'Team lead scheduled Month 1 ground reality kickoff.');
END $$;
