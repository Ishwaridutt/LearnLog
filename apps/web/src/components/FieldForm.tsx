import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FIELD_COLORS, type FieldSummary } from '@study/shared';
import { api } from '../api/client';
import { Button, ErrorText, FormField, inputCls, Modal } from './ui';

/** Create or edit a study field. */
export function FieldForm({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { id: string; name: string; description: string | null; color: string };
  onSaved?: (s: FieldSummary) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? FIELD_COLORS[0]);

  const save = useMutation({
    mutationFn: () => {
      const body = { name, description, color };
      return initial ? api.updateField(initial.id, body) : api.createField(body);
    },
    onSuccess: (s) => {
      qc.invalidateQueries();
      onSaved?.(s);
      onClose();
      if (!initial) {
        setName('');
        setDescription('');
      }
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit study field' : 'New study field'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {initial ? 'Save' : 'Create field'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <FormField label="Name">
          <input autoFocus className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. DSA 2026" />
        </FormField>
        <FormField label="Description" hint="Optional: your goal or source material.">
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Colour</span>
          <div className="flex gap-2">
            {FIELD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <ErrorText error={save.error} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
