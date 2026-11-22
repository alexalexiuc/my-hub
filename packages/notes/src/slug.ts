const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'iu',
  я: 'ia',
  ў: 'u',
  є: 'e',
  і: 'i',
  ї: 'i',
};

/** Transliterates Cyrillic and strips Latin diacritics (Romanian ăâîșț included) to plain ASCII. */
function toAscii(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) out += CYRILLIC[ch] ?? ch;
  return out.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Lowercase, ASCII, hyphenated file slug. Falls back to `note` when nothing usable remains. */
export function slugify(input: string): string {
  const slug = toAscii(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'note';
}

/** Normalises text for matching: lowercase, accents removed, Cyrillic kept, whitespace collapsed. */
export function normalizeForMatch(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
