'use client';

import { useState, FormEvent } from 'react';
import { Shield, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Authentication failed');
      }

      window.location.href = '/dashboard/siem';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access Denied. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-bg">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-lavender/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-sky/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative z-10 w-full max-w-md glass rounded-3xl p-8 shadow-2xl border border-border/30">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-accent-lavender via-accent-sky to-accent-rose" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-bg border border-border/30 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Shield className="w-7 h-7 text-accent-sky animate-pulse" />
          </div>
          <h1 className="text-lg font-black tracking-widest text-white text-center uppercase">CyberOracle Enterprise</h1>
          <p className="text-[9px] text-accent-sky tracking-widest uppercase mt-1.5 font-mono bg-accent-sky/10 border border-accent-sky/20 px-3 py-0.5 rounded-full">
            Authentication Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-txt-dim mb-2 font-mono">Operator Identity</label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Operator ID (admin)"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-txt-dim mb-2 font-mono">Access Passphrase</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access Token"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-[10px] text-accent-rose bg-accent-rose/10 border border-accent-rose/20 p-3 rounded-xl font-mono">
              [ALERT] {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            <KeyRound className="w-4 h-4" />
            {loading ? 'Clearance checks...' : 'Establish Session'}
          </Button>
        </form>

        <div className="mt-8 text-center text-[8px] text-txt-faint font-mono tracking-widest uppercase border-t border-border/30 pt-4">
          ENCRYPTED LINK | LEVEL 3 COMPLIANCE
        </div>
      </div>
    </div>
  );
}