import { notFound } from "next/navigation";

// Prototype routes for evaluating three UI/UX directions (docs/ui-concepts.md) — dev-only,
// never reachable in a production build, and entirely additive: no production route,
// component, or backend function is modified to support these.
export default function ConceptsLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
