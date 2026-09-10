import Link from "next/link";

export function ConceptSubNav({
  base,
  labels,
}: {
  base: string; // e.g. "/concepts/a"
  labels: { home: string; search: string; profile: string };
}) {
  return (
    <nav className="flex gap-5 text-sm font-medium">
      <Link href={base} className="hover:underline">
        {labels.home}
      </Link>
      <Link href={`${base}/search`} className="hover:underline">
        {labels.search}
      </Link>
      <Link href={`${base}/profile`} className="hover:underline">
        {labels.profile}
      </Link>
    </nav>
  );
}
