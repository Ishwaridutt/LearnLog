import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { setFocusPrefs, useFocusPrefs } from '../../lib/focusPrefs';
import { BUILTIN_SOUNDS, DEFAULT_SOUND, previewSound } from '../../lib/sounds';
import { Button, inputBase } from '../ui';

const SOURCES = [
  { name: 'Pixabay', url: 'https://pixabay.com/sound-effects/search/alarm/', note: 'free, no attribution' },
  { name: 'Mixkit', url: 'https://mixkit.co/free-sound-effects/alarm/', note: 'free licence' },
  { name: 'Freesound', url: 'https://freesound.org/search/?q=bell', note: 'check each licence' },
];

/** Alarm sound picker: built-in synthesised sounds plus files from the repo's sounds/ folder. */
export function SoundSettings() {
  const prefs = useFocusPrefs();
  const files = useQuery({ queryKey: ['focus-sounds'], queryFn: api.focusSounds });
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  const fileIds = new Set((files.data?.sounds ?? []).map((s) => `file:${s.file}`));
  // A custom file that was removed from the folder falls back to the default.
  const selected = prefs.sound.startsWith('file:') && files.data && !fileIds.has(prefs.sound) ? DEFAULT_SOUND : prefs.sound;

  const test = () => {
    stopRef.current?.();
    stopRef.current = previewSound(selected, prefs.volume);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5">
      <h2 className="font-semibold text-slate-900">Alarm sound</h2>

      <div className="flex gap-2">
        <select className={`${inputBase} min-w-0 flex-1`} value={selected} onChange={(e) => setFocusPrefs({ sound: e.target.value })} aria-label="Alarm sound">
          <optgroup label="Built in">
            {Object.entries(BUILTIN_SOUNDS).map(([key, s]) => (
              <option key={key} value={`builtin:${key}`}>
                {s.label}
              </option>
            ))}
          </optgroup>
          {!!files.data?.sounds.length && (
            <optgroup label="Your sounds">
              {files.data.sounds.map((s) => (
                <option key={s.file} value={`file:${s.file}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <Button onClick={test} title="Play the sound once">
          ▶ Test
        </Button>
      </div>

      <label className="block text-xs text-slate-500">
        Volume {Math.round(prefs.volume * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={prefs.volume}
          onChange={(e) => setFocusPrefs({ volume: Number(e.target.value) })}
          className="mt-1 block w-full accent-indigo-600"
        />
      </label>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Add your own sounds</p>
        <p>
          Put <code>.mp3</code>, <code>.wav</code>, <code>.ogg</code> or <code>.m4a</code> files in{' '}
          <code className="rounded bg-slate-100 px-1" title={files.data?.folder}>
            sounds/
          </code>{' '}
          in the project folder, then refresh this list. Short clips (1–5 s)
          work best; the alarm loops for up to a minute.
        </p>
        <ul className="space-y-0.5">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                {s.name}
              </a>{' '}
              <span className="text-slate-400">({s.note})</span>
            </li>
          ))}
        </ul>
        <Button size="sm" disabled={files.isFetching} onClick={() => void files.refetch()}>
          ↻ Refresh list
        </Button>
      </div>
    </section>
  );
}
