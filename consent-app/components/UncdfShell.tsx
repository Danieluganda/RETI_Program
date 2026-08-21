export function UncdfShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell partner-shell">
      <aside className="sidebar partner-sidebar">
        <div className="brand">
          <strong>UNCDF</strong>
          <span>Consented participant data</span>
        </div>
        <nav className="nav">
          <a href="/uncdf">Consented Data</a>
          <a href="/api/exports/uncdf" download>
            Download Excel
          </a>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
