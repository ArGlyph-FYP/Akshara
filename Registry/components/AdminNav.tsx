"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/participants", "Participants"],
  ["/admin/upload", "Upload"],
  ["/admin/samples", "Samples"],
  ["/admin/surveys", "Survey"],
  ["/admin/criteria", "Criteria"],
  ["/admin/raters", "Team & raters"],
  ["/admin/assignments", "Assignments"],
  ["/admin/export", "Export"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {LINKS.map(([href, label]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-2.5 py-1 whitespace-nowrap ${active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
