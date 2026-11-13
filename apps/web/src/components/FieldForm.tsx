import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { addDays, FIELD_COLORS, FIELD_PALETTE, studyDay, type FieldSummary, type FieldTile } from '@study/shared';
import { api } from '../api/client';
import { Button, ErrorText, FormField, inputCls, Modal } from './ui';

/** "1, 3, 7" → [1, 3, 7] plus a validation message (shared with the settings page rules). */
function parseLadder(text: string): { values: number[]; error: string | null } {
  const values = text
    .split(/[\s,→>-]+/)
    .filter(Boolean)
    .map(Number);
  if (!values.length || values.some((n) => !Number.isInteger(n) || n < 1)) {
    return { values, error: 'Use whole numbers of days, e.g. 1, 3, 7, 16' };
  }
  if (values.some((n, i) => i > 0 && n <= values[i - 1])) return { values, error: 'Each interval must be longer than the previous one' };
  return { values, error: null };
}

/** Create or edit a subject (StudyField), including its optional target (F-25) and revision ladder (F-26). */
export function FieldForm({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: FieldTile;
  onSaved?: (s: FieldSummary) => void;
}) {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const globalLadder = settings.data?.revisionIntervals ?? [];
  const today = studyDay(new Date(), settings.data?.dayStartHour ?? 0);

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const fields = useQuery({ queryKey: ['fields', false], queryFn: () => api.fields(false), enabled: !initial });
  const used = new Set((fields.data ?? []).map((f) => f.color.toLowerCase()));
  // New subjects start on the first preset no other subject uses, so they're told apart at a glance.
  const freshColor = FIELD_COLORS.find((c) => !used.has(c)) ?? FIELD_COLORS[0];
  const [picked, setColor] = useState<string | null>(initial?.color ?? null);
  const color = picked ?? freshColor;

  const [hasTarget, setHasTarget] = useState(!!initial?.targetTopicCount);
  const [targetCount, setTargetCount] = useState(initial?.targetTopicCount ? String(initial.targetTopicCount) : '');
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? addDays(today, 30));

  const [customLadder, setCustomLadder] = useState(!!initial?.customIntervals);
  const [ladderText, setLadderText] = useState((initial?.customIntervals ?? globalLadder).join(', '));
  const ladder = parseLadder(ladderText);

  const targetError =
    hasTarget && (!Number.isInteger(Number(targetCount)) || Number(targetCount) < 1)
      ? 'Enter how many topics you want completed'
      : hasTarget && !targetDate
        ? 'Pick a target date'
        : null;
  const invalid = !name.trim() || !!targetError || (customLadder && !!ladder.error);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description,
        color,
        targetTopicCount: hasTarget ? Number(targetCount) : null,
        targetDate: hasTarget ? targetDate : null,
        revisionIntervals: customLadder ? ladder.values : null,
      };
      return initial ? api.updateField(initial.id, body) : api.createField(body);
    },
    onSuccess: (s) => {
      qc.invalidateQueries();
      onSaved?.(s);
      onClose();
      if (!initial) {
        setName('');
        setDescription('');
        setColor(null);
        setHasTarget(false);
        setCustomLadder(false);
      }
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit subject' : 'Add subject'}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
            {initial ? 'Save' : 'Add subject'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) save.mutate();
        }}
      >
        <FormField label="Name">
          <input autoFocus className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. DSA 2026, System Design, UPSC History" />
        </FormField>
        <FormField label="Description" hint="Optional: your goal or source material.">
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <ColorPicker value={color} onChange={setColor} used={used} />

        <OptionalSection
          checked={hasTarget}
          onToggle={setHasTarget}
          title="Set a target"
          hint="Optional. Shows whether you're ahead or behind, measured from today. Leave it off to study at your own pace."
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Completed topics">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={targetCount}
                placeholder="e.g. 60"
                onChange={(e) => setTargetCount(e.target.value)}
              />
            </FormField>
            <FormField label="By">
              <input type="date" className={inputCls} value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
            </FormField>
          </div>
          {targetError && <p className="mt-1 text-xs text-rose-600">{targetError}</p>}
          {initial?.targetTopicCount && (
            <p className="mt-1 text-xs text-slate-500">Changing the number or date re-plans the pace from today.</p>
          )}
        </OptionalSection>

        <OptionalSection
          checked={customLadder}
          onToggle={(on) => {
            setCustomLadder(on);
            if (on && !initial?.customIntervals) setLadderText(globalLadder.join(', '));
          }}
          title="Custom revision intervals"
          hint={`Optional. Otherwise this subject uses your global ladder (${globalLadder.join(' → ')} days). Changes apply from each topic's next revision.`}
        >
          <FormField label="Intervals (days)" hint={ladder.error ?? `${ladder.values.join(' → ')} days, then Mastered`}>
            <input className={inputCls} value={ladderText} onChange={(e) => setLadderText(e.target.value)} aria-invalid={!!ladder.error} />
          </FormField>
        </OptionalSection>

        <ErrorText error={save.error} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function OptionalSection({
  checked,
  onToggle,
  title,
  hint,
  children,
}: {
  checked: boolean;
  onToggle: (on: boolean) => void;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-colors ${checked ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200'}`}>
      <label className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-slate-700">{title}</span>
          <span className="block text-xs text-slate-500">{hint}</span>
        </span>
      </label>
      {checked && <div className="mt-3 pl-6.5">{children}</div>}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Preset swatches in hue order plus a custom colour (system picker or typed hex). */
function ColorPicker({ value, onChange, used }: { value: string; onChange: (c: string) => void; used: Set<string> }) {
  const current = value.toLowerCase();
  const preset = FIELD_PALETTE.find((c) => c.hex === current);
  const [hex, setHex] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setHex(value);
  }
  const hexOk = HEX.test(hex);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">Colour</span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-full" style={{ background: value }} />
          {preset?.name ?? 'Custom'} <code className="text-slate-400">{current}</code>
        </span>
      </div>
      <div className="grid grid-cols-10 gap-2" role="radiogroup" aria-label="Subject colour">
        {FIELD_PALETTE.map((c) => {
          const on = c.hex === current;
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={c.name}
              title={used.has(c.hex) ? `${c.name} (already used by a subject)` : c.name}
              onClick={() => onChange(c.hex)}
              className={`relative grid aspect-square w-full place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                on ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-surface' : ''
              }`}
              style={{ background: c.hex }}
            >
              {on ? (
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 10.5 3.5 3.5L15 7" />
                </svg>
              ) : (
                used.has(c.hex) && <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label
          className={`relative grid h-8 w-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full ring-offset-2 ring-offset-surface ${
            preset ? 'ring-1 ring-slate-300' : 'ring-2 ring-slate-900'
          }`}
          style={{ background: preset ? 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)' : value }}
          title="Pick any colour"
        >
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour" />
        </label>
        <input
          className={`${inputCls} max-w-[8rem] font-mono text-xs`}
          value={hex}
          maxLength={7}
          spellCheck={false}
          aria-label="Hex colour"
          aria-invalid={!hexOk}
          placeholder="#4f46e5"
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setHex(v);
            if (HEX.test(v)) onChange(v.toLowerCase());
          }}
        />
        <span className="text-xs text-slate-500">{hexOk ? 'Custom: pick any colour or type a hex code' : 'Use 6 hex digits, e.g. #4f46e5'}</span>
      </div>
      {used.size > 0 && <p className="mt-1.5 text-[11px] text-slate-400">A dot marks colours other subjects already use.</p>}
    </div>
  );
}
