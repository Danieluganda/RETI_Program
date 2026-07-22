import Link from "next/link";
import { demoUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>10X Consent</strong>
          <span>10X Program MVP</span>
        </div>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/consent/sample">Sample Space Consent</Link>
          <Link href="/consent/partner">Partner Consent</Link>
          <Link href="/records">Consent Records</Link>
          <Link href="/participants/pending">Pending Participants</Link>
        </nav>
        <div className="sidebar-user">
          <strong>{demoUser.name}</strong>
          <span>{demoUser.role}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
