export function BusalaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell partner-shell">
      <aside className="sidebar partner-sidebar">
        <div className="brand">
          <strong>Busala</strong>
          <span>Consented sample data</span>
        </div>
        <nav className="nav">
          <a href="/busala">Consented Data</a>
          <a href="/api/exports/busala">Download ZIP</a>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
