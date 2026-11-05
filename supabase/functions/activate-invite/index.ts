// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, activationCode, password } = await req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(activationCode || '').trim().toUpperCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cleanCode) {
      return new Response(
        JSON.stringify({ error: 'One-time activation code is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // 1. Look up pending workspace invitation
    const { data: invite, error: inviteErr } = await adminClient
      .from('workspace_members')
      .select('*')
      .ilike('invited_email', cleanEmail)
      .eq('status', 'invited')
      .limit(1)
      .single();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({
          error: 'Invalid email or activation code.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check rate-limiting lockout
    if (invite.activation_locked_until) {
      const lockedUntil = new Date(invite.activation_locked_until).getTime();
      if (Date.now() < lockedUntil) {
        return new Response(
          JSON.stringify({
            error: 'Too many failed attempts. Please wait 15 minutes before trying again.',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Check expiration
    if (
      !invite.activation_code_hash ||
      (invite.activation_code_expires_at &&
        Date.now() > new Date(invite.activation_code_expires_at).getTime())
    ) {
      return new Response(
        JSON.stringify({
          error: 'Activation code has expired or is not set. Ask a teammate to re-invite you.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Verify cryptographic hash of the one-time activation code
    const providedHash = await sha256Hex(cleanCode);
    if (!timingSafeEqual(providedHash, String(invite.activation_code_hash))) {
      const nextAttempts = (invite.activation_attempts || 0) + 1;
      const lockUntil =
        nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      await adminClient
        .from('workspace_members')
        .update({
          activation_attempts: nextAttempts,
          activation_locked_until: lockUntil,
        })
        .eq('id', invite.id);

      return new Response(
        JSON.stringify({ error: 'Invalid email or activation code.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Find existing Auth user or create one with email_confirm: true
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
          JSON.stringify({ error: updateErr?.message || 'Failed to update user password.' }),
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
          JSON.stringify({ error: createErr?.message || 'Failed to create user account.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = createdUser.user.id;
    }

    // 6. Ensure profile exists without overwriting existing profile fields
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
        role: invite.invited_role || 'Team Member',
        avatar_color: '#164E33',
        is_team_lead: Boolean(invite.invited_is_team_lead),
      });
    }

    // 7. Activate membership and invalidate the one-time code to prevent reuse
    const { error: activateErr } = await adminClient
      .from('workspace_members')
      .update({
        user_id: userId,
        status: 'active',
        activation_code_hash: null,
        activation_code_expires_at: null,
        activation_attempts: 0,
        activation_locked_until: null,
      })
      .eq('id', invite.id);

    if (activateErr) {
      return new Response(
        JSON.stringify({ error: activateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account activated successfully!' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unexpected error during activation.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
