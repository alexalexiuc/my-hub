'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, Button, DisclosureToggle } from '@/components';
import { measurementTypeKeys } from '@my-hub/shared/constants';

type AutomationApiSectionProps = {
  userId: string | undefined;
  initialKey: string | null | undefined;
};

export function AutomationApiSection({ userId, initialKey }: AutomationApiSectionProps) {
  const [automationKey, setAutomationKey] = useState<string | null>(initialKey ?? null);
  const [showKey, setShowKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [instructionsOpenSignal, setInstructionsOpenSignal] = useState(0);

  async function generateKey() {
    setIsGenerating(true);
    try {
      const data = await apiFetch<{ automationApiKey: string }>('/api/calories/profile/automation-key', {
        method: 'POST',
        silentToast: true,
      });
      setAutomationKey(data.automationApiKey);
      setShowKey(true);
      setInstructionsOpenSignal(v => v + 1);
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      },
      () => {
        setCopied(`${label}:err`);
        setTimeout(() => setCopied(null), 2000);
      },
    );
  }

  const endpointUrl = userId ? `${window.location.origin}/api/calories/automation/${userId}/measurements` : '';
  const exampleBody = JSON.stringify({ typeKey: 'weight', value: 75.5, date: '2026-04-30' }, null, 2);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Automation API</h2>
      </div>

      <div className="p-5">
        {!automationKey ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Generate an API key to log measurements from external automations (e.g. iOS Shortcuts).
            </p>
            <Button onClick={() => void generateKey()} loading={isGenerating} size="sm">
              {isGenerating ? 'Generating...' : 'Generate API Key'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--muted)] shrink-0">API Key</span>
              <code className="break-all select-all rounded border border-[var(--border)] bg-[var(--card2)] px-2 py-1 font-mono text-xs text-[var(--text)]">
                {showKey ? automationKey : '•'.repeat(16)}
              </code>
              <button
                type="button"
                className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                onClick={() => setShowKey(v => !v)}
              >
                {showKey ? 'Hide' : 'Reveal'}
              </button>
              <button
                type="button"
                className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                onClick={() => copyToClipboard(automationKey, 'key')}
              >
                {copied === 'key' ? '✓ Copied' : copied === 'key:err' ? 'Failed' : 'Copy key'}
              </button>
              <button
                type="button"
                className="text-xs text-[var(--subtle)] transition-colors hover:text-[var(--amber)]"
                onClick={() => void generateKey()}
                disabled={isGenerating}
              >
                {isGenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>

            <DisclosureToggle label="API instructions" openSignal={instructionsOpenSignal}>
              <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card2)] p-4 text-xs">
                <div>
                  <p className="mb-1 font-medium uppercase tracking-wide text-[var(--subtle)]">Endpoint</p>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 break-all font-mono text-[var(--text)]">POST {endpointUrl}</code>
                    <button
                      type="button"
                      className="shrink-0 text-[var(--subtle)] hover:text-[var(--text)]"
                      onClick={() => copyToClipboard(`POST ${endpointUrl}`, 'url')}
                    >
                      {copied === 'url' ? '✓' : copied === 'url:err' ? '✗' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-medium uppercase tracking-wide text-[var(--subtle)]">Authorization header</p>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 break-all font-mono text-[var(--text)]">
                      Bearer {showKey ? automationKey : '•'.repeat(16)}
                    </code>
                    <button
                      type="button"
                      className="shrink-0 text-[var(--subtle)] hover:text-[var(--text)]"
                      onClick={() => copyToClipboard(`Bearer ${automationKey}`, 'auth')}
                    >
                      {copied === 'auth' ? '✓' : copied === 'auth:err' ? '✗' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-medium uppercase tracking-wide text-[var(--subtle)]">
                    Body — single object or array
                  </p>
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 whitespace-pre-wrap font-mono text-[var(--text)]">{exampleBody}</pre>
                    <button
                      type="button"
                      className="shrink-0 text-[var(--subtle)] hover:text-[var(--text)]"
                      onClick={() => copyToClipboard(exampleBody, 'body')}
                    >
                      {copied === 'body' ? '✓' : copied === 'body:err' ? '✗' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-1 text-[var(--subtle)]">
                    <code>date</code> is optional — defaults to today. Send an array to log multiple measurements in one
                    request.
                  </p>
                </div>

                <p className="text-[var(--subtle)]">
                  Available:{' '}
                  {measurementTypeKeys.map(t => (
                    <code key={t} className="font-mono">
                      {t}{' '}
                    </code>
                  ))}
                </p>
              </div>
            </DisclosureToggle>
          </div>
        )}
      </div>
    </Card>
  );
}
