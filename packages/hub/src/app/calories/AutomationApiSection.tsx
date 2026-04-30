'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { SectionCard, Button } from '@/components';

type AutomationApiSectionProps = {
  userId: string | undefined;
  initialKey: string | null | undefined;
};

export function AutomationApiSection({ userId, initialKey }: AutomationApiSectionProps) {
  const [automationKey, setAutomationKey] = useState<string | null>(initialKey ?? null);
  const [showKey, setShowKey] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function generateKey() {
    setIsGenerating(true);
    try {
      const data = await apiFetch<{ automationApiKey: string }>('/api/calories/profile/automation-key', {
        method: 'POST',
        silentToast: true,
      });
      setAutomationKey(data.automationApiKey);
      setShowKey(true);
      setShowInstructions(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const endpointUrl = userId ? `${window.location.origin}/api/calories/automation/${userId}/measurements` : '';

  const exampleBody = JSON.stringify({ typeKey: 'weight', value: 75.5, date: '2026-04-30' }, null, 2);

  return (
    <SectionCard title="Automation API">
      {!automationKey ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Generate an API key to log measurements from external automations (e.g. iOS Shortcuts).
          </p>
          <Button onClick={() => void generateKey()} loading={isGenerating} size="sm">
            {isGenerating ? 'Generating...' : 'Generate API Key'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Key display row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-400 shrink-0">API Key</span>
            <code className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 font-mono break-all select-all">
              {showKey ? automationKey : '•'.repeat(16)}
            </code>
            <button
              type="button"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              onClick={() => setShowKey(v => !v)}
            >
              {showKey ? 'Hide' : 'Reveal'}
            </button>
            <button
              type="button"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              onClick={() => copyToClipboard(automationKey, 'key')}
            >
              {copied === 'key' ? '✓ Copied' : 'Copy key'}
            </button>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
              onClick={() => void generateKey()}
              disabled={isGenerating}
            >
              {isGenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>

          {/* Instructions toggle */}
          <button
            type="button"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
            onClick={() => setShowInstructions(v => !v)}
          >
            <span>{showInstructions ? '▼' : '▶'}</span>
            <span>API instructions</span>
          </button>

          {showInstructions && (
            <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-xs">
              {/* Endpoint URL */}
              <div>
                <p className="text-zinc-500 mb-1 font-medium uppercase tracking-wide">Endpoint</p>
                <div className="flex items-start gap-2">
                  <code className="font-mono text-zinc-200 break-all flex-1">POST {endpointUrl}</code>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-200 shrink-0"
                    onClick={() => copyToClipboard(`POST ${endpointUrl}`, 'url')}
                  >
                    {copied === 'url' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Auth header */}
              <div>
                <p className="text-zinc-500 mb-1 font-medium uppercase tracking-wide">Authorization header</p>
                <div className="flex items-start gap-2">
                  <code className="font-mono text-zinc-200 break-all flex-1">
                    Bearer {showKey ? automationKey : '•'.repeat(16)}
                  </code>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-200 shrink-0"
                    onClick={() => copyToClipboard(`Bearer ${automationKey}`, 'auth')}
                  >
                    {copied === 'auth' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Example body */}
              <div>
                <p className="text-zinc-500 mb-1 font-medium uppercase tracking-wide">Body — single object or array</p>
                <div className="flex items-start gap-2">
                  <pre className="font-mono text-zinc-200 flex-1 whitespace-pre-wrap">{exampleBody}</pre>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-200 shrink-0"
                    onClick={() => copyToClipboard(exampleBody, 'body')}
                  >
                    {copied === 'body' ? '✓' : 'Copy'}
                  </button>
                </div>
                <p className="text-zinc-600 mt-1">
                  <code>date</code> is optional — defaults to today. Send an array to log multiple measurements in one
                  request.
                </p>
              </div>

              {/* Available types hint */}
              <p className="text-zinc-600">
                Available <code>typeKey</code> values: <code>weight</code>, <code>height</code>, <code>waist</code>,{' '}
                <code>hips</code>, <code>chest</code>, <code>neck</code>, <code>bicep</code>, <code>body_fat</code>
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
