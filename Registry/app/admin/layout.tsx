import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { SignOutButton } from "@/components/SignOutButton";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <Link href="/admin" className="text-sm font-semibold tracking-wider text-accent">
            AKSHARA
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            {s.user.scripts.length > 0 && (
              <Link href="/rate" className="btn btn-sm">
                Rate
              </Link>
            )}
            <span className="hidden md:inline">{s.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
