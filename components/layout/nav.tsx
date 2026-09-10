import Link from "next/link";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ButtonLink } from "@/components/ui/button";

export async function Nav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-primary">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-foreground-muted md:flex">
          <Link href="/search" className="hover:text-foreground">
            Search
          </Link>
          <Link href="/explore" className="hover:text-foreground">
            Explore
          </Link>
          {session?.user && (
            <>
              <Link href="/feed" className="hover:text-foreground">
                Feed
              </Link>
              <Link href="/tracker" className="hover:text-foreground">
                Tracker
              </Link>
            </>
          )}
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {session?.user ? (
            <>
              <Link
                href="/profile"
                className="hidden text-sm text-foreground-muted hover:text-foreground sm:inline"
              >
                {session.user.name ?? session.user.email}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-foreground-muted hover:text-foreground">
                Log in
              </Link>
              <ButtonLink href="/signup" size="sm">
                Find my opportunities
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
