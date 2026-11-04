import type { Link } from '@study/shared';

export function LinkList({ links }: { links: Pick<Link, 'label' | 'url'>[] }) {
  if (!links.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((l, i) => (
        <li key={i}>
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-surface px-2 py-1 text-xs font-medium text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
            title={l.url}
          >
            ↗ {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
