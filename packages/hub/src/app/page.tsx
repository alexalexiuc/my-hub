'use client';

import Link from 'next/link';
import { DashboardFooter, DashboardHeader } from '@/components/dashboard';
import { CaloriesWidget, TodoWidget, TravelWidget } from '@/components/widgets';
import {
  UtensilsOutlineIcon,
  ListChecksOutlineIcon,
  BeeOutlineIcon,
  PlaneOutlineIcon,
  ServerOutlineIcon,
  UserPlusOutlineIcon,
  BarChartIcon,
} from '@/components/icons';

const appSections = [
  {
    href: '/calories',
    label: 'Calories',
    description: 'Track meals, body measurements & nutrition goals',
    color:
      'bg-gradient-to-br from-orange-950/40 to-zinc-900 border-orange-800/50 hover:border-orange-500/70 hover:shadow-lg hover:shadow-orange-950/20 hover:-translate-y-0.5',
    labelColor: 'text-orange-400',
    accentColor: 'bg-orange-500/20',
    icon: <UtensilsOutlineIcon className="size-5" />,
  },
  {
    href: '/todo',
    label: 'Todo',
    description: 'Simple todo list with MCP integration',
    color:
      'bg-gradient-to-br from-blue-950/40 to-zinc-900 border-blue-800/50 hover:border-blue-500/70 hover:shadow-lg hover:shadow-blue-950/20 hover:-translate-y-0.5',
    labelColor: 'text-blue-400',
    accentColor: 'bg-blue-500/20',
    icon: <ListChecksOutlineIcon className="size-5" />,
  },
  {
    href: '/apiary',
    label: 'Apiary',
    description: 'Manage bee yards, hives, inspections & tasks',
    color:
      'bg-gradient-to-br from-yellow-950/50 to-zinc-900 border-yellow-800/40 hover:border-yellow-600/60 hover:shadow-lg hover:shadow-yellow-950/30 hover:-translate-y-0.5',
    labelColor: 'text-yellow-400',
    accentColor: 'bg-yellow-500/20',
    icon: <BeeOutlineIcon className="size-5" />,
  },
  {
    href: '/travel',
    label: 'My Travels',
    description: 'Plan trips, track reservations, checklist, companions and documents',
    color:
      'bg-gradient-to-br from-emerald-950/30 to-zinc-900 border-emerald-800/50 hover:border-emerald-600/70 hover:shadow-lg hover:shadow-emerald-950/20 hover:-translate-y-0.5',
    labelColor: 'text-emerald-400',
    accentColor: 'bg-emerald-500/20',
    icon: <PlaneOutlineIcon className="size-5" />,
  },
  {
    href: '/finances',
    label: 'Finances',
    description: 'Track accounts, budgets, transactions & net worth',
    color:
      'bg-gradient-to-br from-violet-950/40 to-zinc-900 border-violet-800/50 hover:border-violet-500/70 hover:shadow-lg hover:shadow-violet-950/20 hover:-translate-y-0.5',
    labelColor: 'text-violet-400',
    accentColor: 'bg-violet-500/20',
    icon: <BarChartIcon className="size-5" />,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 space-y-8">
        <TravelWidget />

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <TodoWidget />
            <CaloriesWidget />
          </div>
        </section>

        {/* App Cards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Apps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {appSections.map(({ href, label, description, color, labelColor, accentColor, icon }) => (
              <Link key={href} href={href} className={`rounded-xl border p-5 transition-all duration-200 ${color}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${accentColor} flex items-center justify-center flex-shrink-0`}>
                    <span className={labelColor}>{icon}</span>
                  </div>
                  <div>
                    <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
                    <p className="text-xs text-zinc-300 mt-0.5">{description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Setup */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/mcp-control"
              className="rounded-xl border border-zinc-700/50 bg-gradient-to-br from-zinc-800/50 to-zinc-900 p-4 shadow-sm hover:border-zinc-600 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-700/60 flex items-center justify-center flex-shrink-0">
                  <ServerOutlineIcon className="size-5 text-zinc-300" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-zinc-200">MCP Control</span>
                  <p className="text-xs text-zinc-400 mt-0.5">Enable or disable MCP servers</p>
                </div>
              </div>
            </Link>
            <Link
              href="/invites"
              className="rounded-xl border border-zinc-700/50 bg-gradient-to-br from-zinc-800/50 to-zinc-900 p-4 shadow-sm hover:border-zinc-600 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-700/60 flex items-center justify-center flex-shrink-0">
                  <UserPlusOutlineIcon className="size-5 text-zinc-300" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-zinc-200">Invite Links</span>
                  <p className="text-xs text-zinc-400 mt-0.5">Invite others to register</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </main>

      <DashboardFooter />
    </div>
  );
}
