'use client';

type Props = {
  items: string[];
  onPick: (title: string) => void;
};

export function TryTheseChips({ items, onPick }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onPick(item)}
          className="rounded-full bg-[color:var(--color-accent)] px-3 py-1.5 text-xs text-[color:#8b3a4f] hover:bg-[color:var(--color-brand-soft)] hover:text-white"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
