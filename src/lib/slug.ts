export type SlugInput = { title: string; creator: string; year: number | null };

function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function lastWord(s: string): string {
  const words = s.trim().split(/\s+/);
  return words[words.length - 1] || s;
}

export function slugify(input: SlugInput): string {
  const titlePart = kebab(input.title);
  const creatorPart = kebab(lastWord(input.creator));
  const yearPart = input.year != null ? String(input.year) : '';
  return [titlePart, creatorPart, yearPart].filter(Boolean).join('-');
}
