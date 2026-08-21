export function RichblackShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell partner-shell">
      <aside className="sidebar partner-sidebar">
        <div className="brand">
          <strong>Richblack</strong>
          <span>Consented participant data</span>
        </div>
        <nav className="nav">
          <a href="/richblack">Consented Data</a>
          <a href="/api/exports/richblack">Download Excel</a>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
