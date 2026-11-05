import React, { useState } from 'react';
import {
  getSupabaseCredentials,
  isSupabaseConfigured,
  setCustomSupabaseCredentials,
} from '../lib/supabase';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { Database, CheckCircle, Copy, Check, ExternalLink, X, Shield, RefreshCw } from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose }) => {
  const { isRealtimeConnected, isSyncing, reconnectSupabase } = useRealtimeStore();
  const currentCreds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(currentCreds.url);
  const [anonKey, setAnonKey] = useState(currentCreds.anonKey);
  const [copiedSql, setCopiedSql] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSave = () => {
    setCustomSupabaseCredentials(supabaseUrl, anonKey);
    setSavedSuccess(true);
    reconnectSupabase();
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);
  };

  const handleCopySql = () => {
    fetch('/supabase-schema.sql')
      .then((res) => {
        if (res.ok) return res.text();
        throw new Error('Fetch failed');
      })
      .then((text) => {
        navigator.clipboard.writeText(text);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2500);
      })
      .catch(() => {
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2500);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold">Supabase Realtime & Postgres Setup</h2>
              <p className="text-xs text-stone-400">Database, Realtime channels, RLS & Storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        <div
          className={`px-5 py-3 text-xs flex items-center justify-between border-b shrink-0 ${
            isConfigured
              ? 'bg-emerald-50 text-emerald-900 border-emerald-100'
              : 'bg-amber-50 text-amber-900 border-amber-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              <strong>Status:</strong>{' '}
              {isConfigured
                ? isRealtimeConnected
                  ? 'Connected to Live Supabase Postgres & Realtime Subscriptions'
                  : 'Connecting to Supabase...'
                : 'Zero-Friction Local Realtime Mode Active (BroadcastChannel Sync)'}
            </span>
          </div>
          <button
            onClick={() => reconnectSupabase()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700 leading-relaxed space-y-2">
            <div className="flex items-center justify-between font-semibold text-stone-900">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-700" />
                Step-by-step Setup Guide
              </span>
              <button
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-medium shadow-xs transition"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'SQL Copied!' : 'Copy supabase-schema.sql'}
              </button>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-stone-600">
              <li>
                Create a project at{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 underline font-medium inline-flex items-center gap-0.5"
                >
                  supabase.com <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li>Open SQL Editor in Supabase, paste and run the copied SQL script.</li>
              <li>
                Enter your Project URL and Anon API Key below or define them in{' '}
                <code>.env</code> as <code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code>.
              </li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Supabase Anon / Public Key
              </label>
              <textarea
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                rows={2}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                setSupabaseUrl('');
                setAnonKey('');
                setCustomSupabaseCredentials('', '');
                reconnectSupabase();
              }}
              className="text-xs text-stone-500 hover:text-red-600 underline"
            >
              Reset to Local Mode
            </button>

            <div className="flex items-center gap-2">
              {savedSuccess && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Saved!
                </span>
              )}
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
