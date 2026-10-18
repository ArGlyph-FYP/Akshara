import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import { requireRater } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default async function RateLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRater();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2">
          <Link href="/rate" className="flex items-center gap-2">
            <Logo />
            <span className="text-sm text-muted-foreground">· rating</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {s.user.role === "admin" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">Admin</Link>
              </Button>
            )}
            <span className="hidden md:inline">{s.user.displayName}</span>
            {/* Public-link readers have no password: signing out would lose their progress link. */}
            {!s.user.public && <SignOutButton />}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
