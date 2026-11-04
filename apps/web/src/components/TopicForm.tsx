import { useState } from 'react';
import type { LinkInput } from '@study/shared';
import { Button, FormField, inputBase, inputCls } from './ui';

export interface TopicFormValue {
  name: string;
  description: string;
  recallPrompt: string;
  links: LinkInput[];
}

export const emptyTopic: TopicFormValue = { name: '', description: '', recallPrompt: '', links: [] };

/** Topic fields + editable list of labelled links (F-03). */
export function TopicFormFields({ value, onChange }: { value: TopicFormValue; onChange: (v: TopicFormValue) => void }) {
  const set = <K extends keyof TopicFormValue>(k: K, v: TopicFormValue[K]) => onChange({ ...value, [k]: v });
  const setLink = (i: number, patch: Partial<LinkInput>) =>
    set(
      'links',
      value.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    );
  const move = (i: number, dir: -1 | 1) => {
    const links = [...value.links];
    const j = i + dir;
    if (j < 0 || j >= links.length) return;
    [links[i], links[j]] = [links[j], links[i]];
    set('links', links);
  };

  return (
    <div className="space-y-4">
      <FormField label="Topic name" hint="Tip: use a prefix to group related topics, e.g. “SW - Max sum subarray”.">
        <input autoFocus className={inputCls} value={value.name} maxLength={200} onChange={(e) => set('name', e.target.value)} />
      </FormField>
      <FormField label="Description / notes">
        <textarea className={inputCls} rows={3} value={value.description} onChange={(e) => set('description', e.target.value)} />
      </FormField>
      <FormField label="Recall prompt (optional)" hint="A question you must answer from memory before revising, e.g. “Write the sliding-window template.”">
        <textarea className={inputCls} rows={2} value={value.recallPrompt} onChange={(e) => set('recallPrompt', e.target.value)} />
      </FormField>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Links</span>
          <Button size="sm" variant="ghost" onClick={() => set('links', [...value.links, { label: '', url: '' }])}>
            + Add link
          </Button>
        </div>
        {value.links.length === 0 && <p className="text-xs text-slate-500">Video, article, problem page, notes… add as many as you need.</p>}
        <div className="space-y-2">
          {value.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${inputBase} w-32 shrink-0`}
                placeholder="Label"
                value={l.label}
                maxLength={40}
                onChange={(e) => setLink(i, { label: e.target.value })}
              />
              <input className={`${inputBase} min-w-0 flex-1`} placeholder="https://…" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
              <div className="flex shrink-0">
                <button type="button" className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  disabled={i === value.links.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="px-1 text-slate-400 hover:text-rose-600"
                  onClick={() => set('links', value.links.filter((_, j) => j !== i))}
                  aria-label="Remove link"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Drop blank link rows; keep partially filled ones so validation can flag them. */
export function toTopicInput(v: TopicFormValue) {
  return {
    name: v.name,
    description: v.description,
    recallPrompt: v.recallPrompt,
    links: v.links.filter((l) => l.label.trim() || l.url.trim()),
  };
}

export function useTopicForm(initial: TopicFormValue = emptyTopic) {
  return useState<TopicFormValue>(initial);
}
