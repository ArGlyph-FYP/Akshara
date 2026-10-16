import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { requireRater } from "@/lib/auth";

export default async function RateLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRater();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2">
          <Link href="/rate" className="text-sm font-semibold tracking-wider text-accent">
            AKSHARA <span className="font-normal text-muted">· rating</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            {s.user.role === "admin" && (
              <Link href="/admin" className="btn btn-sm">
                Admin
              </Link>
            )}
            <span className="hidden font-mono md:inline">{s.user.alias}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
