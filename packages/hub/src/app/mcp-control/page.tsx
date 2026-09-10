'use client';

import { PageHeader } from '@/components';
import { ConnectionsSection } from './ConnectionsSection';
import { ServersSection } from './ServersSection';
import { AuditLogSection } from './AuditLogSection';

export default function McpControlPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <PageHeader title="MCP Service" backHref="/" backLabel="← Home" />
      <ConnectionsSection />
      <ServersSection />
      <AuditLogSection />
    </main>
  );
}
