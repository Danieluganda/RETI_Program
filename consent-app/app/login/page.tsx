export default function LoginPage() {
  return (
    <main className="login-screen">
      <form className="login-card">
        <h1>10X Consent</h1>
        <p>Use the demo collector account to enter the MVP.</p>
        <label>
          Email
          <input name="email" type="email" defaultValue="collector@10x.local" />
        </label>
        <label>
          Password
          <input name="password" type="password" defaultValue="password123" />
        </label>
        <a className="button primary" href="/dashboard">
          Login
        </a>
      </form>
    </main>
  );
}
