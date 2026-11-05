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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. Verify caller's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user: caller },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { workspaceId, email } = await req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!workspaceId || !cleanEmail || !cleanEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid workspaceId and email are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Enforce workspace-owner / Team Lead authorization server-side
    const [{ data: callerProfile }, { data: callerMembership }] = await Promise.all([
      adminClient.from('profiles').select('is_team_lead').eq('id', caller.id).single(),
      adminClient
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', caller.id)
        .eq('status', 'active')
        .single(),
    ]);

    if (!callerMembership || !callerProfile?.is_team_lead) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: Only the workspace owner / Team Lead can generate activation codes.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate unique one-time code and store only its SHA-256 hash
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randBytes = new Uint8Array(8);
    crypto.getRandomValues(randBytes);
    const rawCode = Array.from(randBytes)
      .map((b) => alphabet[b % alphabet.length])
      .join('');
    const formattedCode = `SG-${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;
    const codeHash = await sha256Hex(formattedCode);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: updated, error: updateErr } = await adminClient
      .from('workspace_members')
      .update({
        activation_code_hash: codeHash,
        activation_code_expires_at: expiresAt,
        activation_attempts: 0,
        activation_locked_until: null,
      })
      .eq('workspace_id', workspaceId)
      .ilike('invited_email', cleanEmail)
      .eq('status', 'invited')
      .select('id');

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!updated || updated.length === 0) {
      return new Response(
        JSON.stringify({ error: `No pending invitation found for ${cleanEmail}.` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, code: formattedCode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unexpected error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
