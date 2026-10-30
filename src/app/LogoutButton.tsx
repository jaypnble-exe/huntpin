"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  }
  return (
    <button type="button" onClick={logout} className="ml-auto shrink-0 rounded-md px-2.5 py-1.5 text-sm text-muted hover:text-foreground">
      Log out
    </button>
  );
}
