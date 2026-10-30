"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, InlineMessage, Input } from "@/components/ui";

export function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next: params.get("next") }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Could not sign in.");
      // Full navigation so the new session cookie is used everywhere.
      window.location.assign(body.next ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="text-lg font-semibold">Sign in to LeadRadar</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !password} className="w-full">
          Sign in
        </Button>
        {error && <InlineMessage tone="danger">{error}</InlineMessage>}
      </form>
    </Card>
  );
}
