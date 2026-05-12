'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { Card, SectionLabel } from '../ui';
import type { AccountsListData } from '@/app/api/finances/accounts/route';
import type { BudgetInfo } from '@/app/api/finances/budget/budget.schema';
import type { CategoriesResponse, CategoryGroup, CategoryRow } from '@/app/api/finances/categories/route';

function buildPrompt(
  budget: BudgetInfo,
  accounts: AccountsListData['accounts'],
  groups: CategoryGroup[],
  ungrouped: CategoryRow[],
): string {
  const lines: string[] = [];
  lines.push(`Budget: ${budget.name} (ID: ${budget.id}) | Currency: ${budget.defaultCurrency}`);
  lines.push('');
  lines.push('Accounts:');

  for (const acct of accounts) {
    let entry = `[${acct.id}] ${acct.name} — ${acct.type}, ${acct.currency}`;
    if (acct.cardLastFour) {
      const label = acct.cardName ? `${acct.cardName} *${acct.cardLastFour}` : `card *${acct.cardLastFour}`;
      entry += `, ${label}`;
    }
    if (acct.targetAmount != null) {
      entry += `, target ${acct.targetAmount.toLocaleString()}`;
    }
    lines.push(entry);
  }

  lines.push('');
  lines.push('Categories:');

  const entries: string[] = [];
  for (const group of groups) {
    for (const cat of group.categories) {
      entries.push(`[${cat.id}] ${group.name} > ${cat.name}`);
    }
  }
  for (const cat of ungrouped) {
    entries.push(`[${cat.id}] ${cat.name}`);
  }

  for (let i = 0; i < entries.length; i += 4) {
    lines.push(entries.slice(i, i + 4).join('  '));
  }

  return lines.join('\n');
}

type ClaudePromptSectionProps = {
  budget: BudgetInfo;
};

export function ClaudePromptSection({ budget }: ClaudePromptSectionProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsData, categoriesData] = await Promise.all([
        apiFetch<AccountsListData>('/api/finances/accounts', { silentToast: true }),
        apiFetch<CategoriesResponse>('/api/finances/categories', { silentToast: true }),
      ]);
      const text = buildPrompt(budget, accountsData.accounts, categoriesData.groups, categoriesData.ungrouped);
      setPrompt(text);
    } finally {
      setLoading(false);
    }
  }, [budget]);

  async function handleCopy() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="p-[18px]">
      <SectionLabel className="mb-1">Claude Project Instructions</SectionLabel>
      <p className="mb-3 text-[12px] text-[var(--fin-subtle)]">
        Generate a ready-to-paste instruction block for a Claude project. Paste it into your project&apos;s custom
        instructions so Claude knows all account IDs and categories without calling any tools.
      </p>

      {!prompt ? (
        <Button size="sm" className="self-start" loading={loading} onClick={() => void generate()}>
          Generate instructions
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <pre className="overflow-x-auto rounded-[8px] bg-[var(--fin-surface)] p-[12px] text-[11px] leading-[1.6] text-[var(--fin-text)] whitespace-pre-wrap">
            {prompt}
          </pre>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void handleCopy()}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void generate()} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
