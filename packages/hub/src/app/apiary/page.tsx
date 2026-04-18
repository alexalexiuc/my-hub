'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DashboardTab } from './DashboardTab';
import { HivesTab } from './HivesTab';
import { LogTab } from './LogTab';
import { TasksTab } from './TasksTab';

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'hives', label: 'Hives' },
  { key: 'log', label: 'Log' },
  { key: 'tasks', label: 'Tasks' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export default function ApiaryPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <PageHeader title="Apiary" backHref="/" backLabel="← Home" />

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition rounded-t-lg ${
              activeTab === tab.key
                ? 'text-amber-400 border-b-2 border-amber-400 bg-zinc-900'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'hives' && <HivesTab />}
      {activeTab === 'log' && <LogTab />}
      {activeTab === 'tasks' && <TasksTab />}
    </main>
  );
}
