import { describe, expect, it } from "vitest";
import { BATCH_REVIEW_MAX, pickBatchCandidates } from "./batchReview";

const NOW = new Date("2026-10-30T10:00:00Z");
const lead = (id: string, extra: Partial<{ lead_status: string; website_checked_at: string | null; url: string }> = {}) => ({
  id,
  lead_status: "new",
  website_checked_at: null,
  url: `https://${id}.sa`,
  ...extra,
});

describe("pickBatchCandidates", () => {
  it("keeps order, skips no-URL, opted-out and recently checked leads", () => {
    const picked = pickBatchCandidates(
      [
        lead("a"),
        lead("b", { url: "" }),
        lead("c", { lead_status: "do_not_contact" }),
        lead("d", { lead_status: "not_interested" }),
        lead("e", { website_checked_at: "2026-10-20T00:00:00Z" }),
        lead("f", { website_checked_at: "2026-08-01T00:00:00Z" }),
      ],
      NOW,
    );
    expect(picked).toEqual([
      { id: "a", url: "https://a.sa" },
      { id: "f", url: "https://f.sa" },
    ]);
  });

  it("caps the batch", () => {
    const many = Array.from({ length: 50 }, (_, i) => lead(`l${i}`));
    expect(pickBatchCandidates(many, NOW)).toHaveLength(BATCH_REVIEW_MAX);
  });
});
