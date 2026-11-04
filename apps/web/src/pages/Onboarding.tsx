import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { Button, ErrorText, inputCls } from '../components/ui';

export function Onboarding() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const save = useMutation({
    mutationFn: () => api.saveProfile(name),
    onSuccess: (p) => qc.setQueryData(['profile'], p),
  });
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-indigo-50 to-slate-50 p-4">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl bg-surface p-8 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white">L</div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome to LearnLog</h1>
          <p className="mt-1 text-sm text-slate-500">Learn it once, revise it on schedule, and keep your streak going.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">What should we call you?</span>
          <input autoFocus className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </label>
        <ErrorText error={save.error} />
        <Button type="submit" variant="primary" className="w-full" disabled={!name.trim() || save.isPending}>
          Continue
        </Button>
      </form>
    </div>
  );
}
