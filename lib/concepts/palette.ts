// Deterministic color assignment per opportunity type, for Concept C's tile-forward visual
// treatment. Not meaningful data — purely a display palette.
const PALETTE = [
  "from-rose-400 to-orange-300",
  "from-indigo-400 to-sky-300",
  "from-emerald-400 to-teal-300",
  "from-violet-400 to-fuchsia-300",
  "from-amber-400 to-yellow-300",
  "from-cyan-400 to-blue-300",
  "from-pink-400 to-rose-300",
  "from-lime-400 to-green-300",
];

export function paletteFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
