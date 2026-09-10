'use client';

import { Button, Card, CopyButton } from '@/components';
import { MCP_BASE_URL } from './constants';
import type { CreatedClient } from './types';

type SecretRevealCardProps = {
  client: CreatedClient;
  onDone: () => void;
};

export function SecretRevealCard({ client, onDone }: SecretRevealCardProps) {
  return (
    <Card
      compact
      className="space-y-4 border-2 border-[var(--amber,#fcd34d)]/50 bg-[var(--amber-d,rgba(252,211,77,0.1))]"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none text-[var(--amber,#fcd34d)]">⚠</span>
        <div>
          <p className="font-semibold text-[var(--amber,#fcd34d)]">Save these credentials now</p>
          <p className="mt-0.5 text-sm text-[var(--amber,#fcd34d)]">
            The client secret is shown only once and cannot be retrieved after you close this.
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-[var(--muted,#a1a1aa)]">Client name</span>
          <span className="font-medium">{client.clientName ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-[var(--muted,#a1a1aa)]">Client ID</span>
          <code className="rounded border border-[var(--border,#3f3f46)] bg-[var(--card2,#27272a)] px-2 py-0.5 font-mono text-xs text-[var(--text,#d4d4d8)]">
            {client.clientId}
          </code>
          <CopyButton value={client.clientId} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-[var(--muted,#a1a1aa)]">Client secret</span>
          <code className="rounded border border-[var(--amber,#fcd34d)]/40 bg-[var(--amber-d,rgba(252,211,77,0.08))] px-2 py-0.5 font-mono text-xs text-[var(--amber,#fcd34d)]">
            {client.plainClientSecret}
          </code>
          <CopyButton value={client.plainClientSecret} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-[var(--muted,#a1a1aa)]">MCP URL</span>
          <code className="rounded border border-[var(--border,#3f3f46)] bg-[var(--card2,#27272a)] px-2 py-0.5 font-mono text-xs text-[var(--text,#d4d4d8)]">
            {MCP_BASE_URL}
          </code>
          <CopyButton value={MCP_BASE_URL} />
        </div>
      </div>

      {/* A solid-amber fill can't guarantee readable white text across every theme (amber is a
          light pastel in dark mode), so the confirm action uses the normal accent-button
          treatment — the surrounding card carries the warning framing instead. */}
      <Button variant="accent" className="w-full" onClick={onDone}>
        I&apos;ve saved the credentials — done
      </Button>
    </Card>
  );
}
