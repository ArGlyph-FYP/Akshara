import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  if (s?.kind === "staff") redirect(s.user.role === "admin" ? "/admin" : "/rate");
  redirect("/login");
}
