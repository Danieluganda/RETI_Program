"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <button className="nav-button" type="button" onClick={logout}>
      Logout
    </button>
  );
}
