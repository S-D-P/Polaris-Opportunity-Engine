import Link from "next/link";
import { paletteFor } from "@/lib/concepts/palette";

export function CategoryTile({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className={`flex h-24 flex-col justify-between rounded-2xl bg-gradient-to-br ${paletteFor(label)} p-4 text-white shadow-sm transition-transform hover:scale-[1.02]`}
    >
      <span className="font-display text-base leading-tight">{label}</span>
      {typeof count === "number" && <span className="text-xs opacity-90">{count} opportunities</span>}
    </Link>
  );
}
