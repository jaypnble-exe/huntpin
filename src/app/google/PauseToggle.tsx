"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineMessage } from "@/components/ui";

export function PauseToggle({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchesPaused: !paused }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Could not update the setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={toggle} disabled={saving} aria-pressed={paused} variant={paused ? "primary" : "secondary"}>
        {saving ? "Saving…" : paused ? "Resume searches" : "Pause searches"}
      </Button>
      {error && <InlineMessage tone="danger">{error}</InlineMessage>}
    </div>
  );
}
