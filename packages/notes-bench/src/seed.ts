import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadCorpus, renderNote } from './corpus';
import { rng, type Harness } from './lib';

const SUBJECTS = [
  'cleaning',
  'repair',
  'filter',
  'oil',
  'paint',
  'tool',
  'detergent',
  'service',
  'battery',
  'cable',
  'lamp',
  'cream',
  'glue',
  'brush',
  'pump',
  'valve',
  'sensor',
  'gasket',
  'bearing',
  'belt',
  'fuse',
  'switch',
  'hose',
  'cover',
  'rack',
];
const BRANDS = [
  'Bosch',
  'Makita',
  'Philips',
  'Samsung',
  'Tefal',
  'Karcher',
  'Mann',
  'Sonax',
  'Dulux',
  'Ariel',
  'Lenor',
  'Finish',
  'Varta',
  'Anker',
  'Xiaomi',
  'Fiskars',
  'Gardena',
  'Brembo',
  'Castrol',
  'Liqui Moly',
  'Sika',
  'Henkel',
  'Bahco',
];
const SHOPS = ['Linella', 'Kaufland', 'Metro', 'Darwin', 'Nr.1', 'Bricostore', 'Enter', 'Agro Market', 'Fresh Market'];
const ADJ_EN = ['solid', 'cheap', 'loud', 'quiet', 'fragile', 'reliable', 'overpriced', 'compact', 'heavy', 'durable'];
const ADJ_RO = ['bun', 'ieftin', 'zgomotos', 'silențios', 'fragil', 'fiabil', 'scump', 'compact', 'greu', 'durabil'];
const ADJ_RU = ['хороший', 'дешёвый', 'шумный', 'тихий', 'хрупкий', 'надёжный', 'дорогой', 'компактный', 'тяжёлый'];
const TYPES = ['fact', 'verdict', 'contact', 'price', 'how-to'] as const;

/** Writes the seed corpus (≈95 notes, ≈230 entries) as Markdown files into the harness user's directory. */
export async function writeSeedNotes(h: Harness): Promise<void> {
  for (const note of await loadCorpus()) {
    const file = join(h.userDir, note.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, renderNote(note));
  }
}

/** Deterministic synthetic entry line text in mixed EN / RO / RU. */
function fillerText(rand: () => number, brand: string, subject: string): string {
  const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
  const price = 20 + Math.floor(rand() * 4000);
  switch (Math.floor(rand() * 6)) {
    case 0:
      return `${brand} ${subject} is ${pick(ADJ_EN)}, paid ${price} MDL at ${pick(SHOPS)}`;
    case 1:
      return `${brand} ${subject} e ${pick(ADJ_RO)}, am plătit ${price} MDL la ${pick(SHOPS)}`;
    case 2:
      return `${brand} ${subject} ${pick(ADJ_RU)}, заплатил ${price} MDL в ${pick(SHOPS)}`;
    case 3:
      return `Model ${brand.slice(0, 3).toUpperCase()}-${Math.floor(rand() * 9000) + 100} works with ${pick(SUBJECTS)}`;
    case 4:
      return `Call ${pick(BRANDS)} service on 06${Math.floor(rand() * 9)}xxxxxx, ask for ${pick(SUBJECTS)}`;
    default:
      return `Replace the ${subject} every ${2 + Math.floor(rand() * 18)} months, ${pick(ADJ_EN)} part`;
  }
}

/**
 * Writes synthetic filler notes until the harness holds roughly `targetEntries` entries (seed corpus included),
 * then indexes them. Returns the number of entries added. Filler lives under `bench-filler-*` categories so it
 * can never be mistaken for the golden notes.
 */
/** Entries currently indexed for the bench user. */
export async function countEntries(h: Harness): Promise<number> {
  const res = await h.db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM entries e JOIN notes n ON n.id = e.note_id WHERE n.user_id = 'bench'`,
  );
  return Number(res.rows[0]!.n);
}

export async function growTo(h: Harness, targetEntries: number, seedOffset = 0): Promise<number> {
  const current = await countEntries(h);
  let missing = targetEntries - current;
  if (missing <= 0) return 0;
  const rand = rng(1000 + seedOffset + current);
  const added = missing;
  let noteNo = current;
  while (missing > 0) {
    const brand = BRANDS[Math.floor(rand() * BRANDS.length)]!;
    const subject = SUBJECTS[Math.floor(rand() * SUBJECTS.length)]!;
    const count = Math.min(missing, 2 + Math.floor(rand() * 5));
    const category = `bench-filler-${noteNo % 20}`;
    const dir = join(h.userDir, category);
    await mkdir(dir, { recursive: true });
    const lines = [
      '---',
      `title: ${brand} ${subject} ${noteNo}`,
      `category: ${category}`,
      'tags: []',
      'aliases: []',
      'updated: 2026-01-01',
      '---',
      '',
    ];
    for (let i = 0; i < count; i++) {
      const date = `2026-${String(1 + Math.floor(rand() * 11)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`;
      const id = (noteNo * 7 + i).toString(36).padStart(4, '0');
      lines.push(`- ${date} [${TYPES[Math.floor(rand() * TYPES.length)]}] ${fillerText(rand, brand, subject)} ^${id}`);
    }
    await writeFile(
      join(dir, `${brand.toLowerCase().replace(/\W+/g, '-')}-${subject}-${noteNo}.md`),
      `${lines.join('\n')}\n`,
    );
    missing -= count;
    noteNo++;
  }
  await h.svc.reindex({ full: false });
  return added;
}
