"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-pressed={paused}
        className="rounded-md border border-current px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving…" : paused ? "Resume searches" : "Pause searches"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
