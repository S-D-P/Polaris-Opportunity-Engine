import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/feed");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">Admin</h1>
      <nav className="mt-4 flex gap-5 border-b border-border pb-3 text-sm font-medium text-foreground-muted">
        <Link href="/admin" className="hover:text-foreground">
          Overview
        </Link>
        <Link href="/admin/sources" className="hover:text-foreground">
          Sources
        </Link>
        <Link href="/admin/opportunities" className="hover:text-foreground">
          Review queue
        </Link>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
