/**
 * Print the tools and resources each MCP sub-server registers, without a database or HTTP server.
 * Use it to confirm a new tool is wired up, or to see a domain's surface before designing a new tool.
 *
 * Usage (from packages/mcp-server):
 *   pnpm -s list-tools                 # every domain, names + annotations
 *   pnpm -s list-tools calories --desc # one domain, with each description's first sentence
 *
 * A new sub-server must be added to DOMAINS below (see the mcp-add-server skill).
 */
process.env.DATABASE_URL ??= 'postgres://list-tools:unused@localhost:5432/unused';

type Captured = { kind: 'tool' | 'resource'; name: string; detail: string; description: string };
type Register = (server: never) => void;

const { registerCaloriesTools } = await import('../src/calories/tools/tools');
const { registerCaloriesResources } = await import('../src/calories/resources/resources');
const { registerTravelTools } = await import('../src/travel/tools/tools');
const { registerTravelResources } = await import('../src/travel/resources/index');
const { registerFinancesTools } = await import('../src/finances/tools/tools');
const { registerFinancesResources } = await import('../src/finances/resources/resources');
const { registerVacationTools } = await import('../src/vacation/tools/tools');

const DOMAINS: Record<string, Register[]> = {
  calories: [registerCaloriesTools, registerCaloriesResources],
  travel: [registerTravelTools, registerTravelResources],
  finances: [registerFinancesTools, registerFinancesResources],
  vacation: [registerVacationTools],
};

const args = process.argv.slice(2);
const showDesc = args.includes('--desc');
const wanted = args.filter(a => !a.startsWith('--'));
const firstSentence = (s = '') => s.split(/(?<=\.)\s/)[0] ?? '';

for (const [domain, registers] of Object.entries(DOMAINS)) {
  if (wanted.length && !wanted.includes(domain)) continue;
  const captured: Captured[] = [];
  const fake = {
    registerTool: (name: string, config: { description?: string; annotations?: Record<string, boolean> }) =>
      captured.push({
        kind: 'tool',
        name,
        detail: Object.entries(config.annotations ?? {})
          .map(([k, v]) => `${k.replace('Hint', '')}=${v}`)
          .join(' '),
        description: config.description ?? '',
      }),
    registerResource: (name: string, uri: string, meta: { description?: string }) =>
      captured.push({ kind: 'resource', name, detail: uri, description: meta.description ?? '' }),
  };
  for (const register of registers) register(fake as never);

  console.log(`# ${domain} (${captured.filter(c => c.kind === 'tool').length} tools)`);
  for (const c of captured) {
    console.log(`  ${c.kind === 'tool' ? 'tool' : 'res '} ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
    if (showDesc) console.log(`       ${firstSentence(c.description)}`);
  }
}
