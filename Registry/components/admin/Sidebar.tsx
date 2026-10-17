"use client";

import { Database, LogOut, Menu, MessagesSquare, Star, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut } from "firebase/auth";
import { setScript } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { clientAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import type { Script } from "@/lib/types";

const NAV = [
  { href: "/admin/dataset", label: "Dataset", icon: Database, key: "dataset" },
  { href: "/admin/survey", label: "Survey", icon: MessagesSquare, key: "survey" },
  { href: "/admin/raters", label: "Raters", icon: Users, key: "raters" },
] as const;

export interface SidebarProps {
  script: Script;
  counts: Record<(typeof NAV)[number]["key"], number>;
  user: { name: string; email: string; canRate: boolean };
}

async function logout() {
  await fetch("/api/session", { method: "DELETE" });
  await signOut(clientAuth()).catch(() => {});
  window.location.href = "/login";
}

function ScriptSwitch({ script }: { script: Script }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={cn("grid grid-cols-2 rounded-lg bg-muted p-0.5 text-sm", pending && "opacity-60")}>
      {(["si", "ta"] as const).map((s) => (
        <button
          key={s}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setScript(s);
              router.refresh();
            })
          }
          className={cn(
            "rounded-md py-1.5 font-medium transition",
            script === s ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s === "si" ? "සිංහල" : "தமிழ்"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{s === "si" ? "Sinhala" : "Tamil"}</span>
        </button>
      ))}
    </div>
  );
}

function NavBody({ script, counts, user, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/admin/dataset" onClick={onNavigate} className="flex items-center gap-2 px-1">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">අ</span>
        <span>
          <span className="block text-sm font-semibold tracking-wide">Akshara</span>
          <span className="block text-xs text-muted-foreground">Registry</span>
        </span>
      </Link>
      <ScriptSwitch script={script} />
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon, key }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
              <span className="ml-auto text-xs tabular-nums opacity-70">{counts[key]}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2">
        {user.canRate && (
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link href="/rate" onClick={onNavigate}>
              <Star /> My rating queue
            </Link>
          </Button>
        )}
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">
            {user.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar md:block">
        <NavBody {...props} />
      </aside>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-sidebar px-4 py-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <NavBody {...props} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">Akshara Registry</span>
        <span className="ml-auto text-xs text-muted-foreground">{props.script === "si" ? "Sinhala" : "Tamil"}</span>
      </div>
    </>
  );
}
