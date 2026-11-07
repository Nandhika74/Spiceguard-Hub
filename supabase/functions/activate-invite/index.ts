// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPROVED_TEAM_EMAILS = new Set([
  'nithyasree2410841@ssn.edu.in',
  'nandhikas3@gmail.com',
  'abhijithsriram2410202@ssn.edu.in',
  'sivakumarans.bbt24@rathinam.in',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !APPROVED_TEAM_EMAILS.has(cleanEmail)) {
      return new Response(
        JSON.stringify({
          error: 'Only the four approved SpiceGuard Hub team members can set up an account.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || String(password).length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find existing Auth user or create one with email_confirm: true
    const { data: usersData, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) {
      return new Response(
        JSON.stringify({ error: listErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = (usersData?.users || []).find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    let userId: string;
    if (existingUser) {
      const { data: updatedUser, error: updateErr } =
        await adminClient.auth.admin.updateUserById(existingUser.id, {
          password: String(password),
          email_confirm: true,
        });
      if (updateErr || !updatedUser.user) {
        return new Response(
          JSON.stringify({ error: updateErr?.message || 'Failed to update password.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = updatedUser.user.id;
    } else {
      const { data: createdUser, error: createErr } =
        await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: String(password),
          email_confirm: true,
        });
      if (createErr || !createdUser.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message || 'Failed to create account.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = createdUser.user.id;
    }

    // 2. Ensure profile exists without overwriting existing profile fields
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      await adminClient.from('profiles').insert({
        id: userId,
        email: cleanEmail,
        full_name: cleanEmail.split('@')[0],
        role: 'Team Member',
        avatar_color: '#164E33',
        is_team_lead: cleanEmail === 'nithyasree2410841@ssn.edu.in',
      });
    }

    // 3. If they have a pending invitation, activate it; if already active, preserve it
    const { data: pendingInvite } = await adminClient
      .from('workspace_members')
      .select('id')
      .ilike('invited_email', cleanEmail)
      .eq('status', 'invited')
      .maybeSingle();

    if (pendingInvite) {
      await adminClient
        .from('workspace_members')
        .update({ user_id: userId, status: 'active' })
        .eq('id', pendingInvite.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password set! Signing you in...' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unexpected error during account setup.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
