import { describe, expect, it, vi } from "vitest";
import { DEFAULT_QUEUE_QUERY } from "../leads/queue";
import { buildQueue, QueueBlockedError, QueueLimitError, recordSent } from "./queueStore";
import { createSupabaseAdmin } from "./supabase";

const LEAD_ID = "3f1c7a52-8f0e-4b8a-9d55-0c2a1f6e4b10";
const PLACE = {
  name: "Basic Cafe",
  basic_category: "cafe",
  web_presence: "social_only",
  has_instagram: false,
  phones: ["+966501112222"],
  emails: [],
  websites: [],
  socials: [],
  lat: 21.5,
  lon: 39.2,
  area: "jeddah",
  source_datasets: [],
  source_licenses: [],
  lead_score: 80,
  chain_size: 1,
};
const LEAD = {
  id: LEAD_ID,
  label: "Basic Cafe",
  operator_notes: null,
  lead_status: "new",
  first_contacted_at: null,
  last_contacted_at: null,
  overture_place_id: "place-1",
  follow_up_on: null,
  follow_up_count: 0,
  confirmed_opportunities: [],
  place: PLACE,
};

type Req = { method: string; url: URL; body: unknown };
type Handler = (req: Req) => { status?: number; body: unknown; count?: number };

function setup(handler: Handler) {
  const calls: Req[] = [];
  const fetchFn = vi.fn<typeof fetch>(async (input, init) => {
    const req = { method: init?.method ?? "GET", url: new URL(String(input)), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(req);
    const { status = 200, body, count } = handler(req);
    // single()/maybeSingle() ask for one object; others get an array.
    const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object");
    const payload = wantsObject || status >= 400 ? body : Array.isArray(body) ? body : body === null ? [] : [body];
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (count !== undefined) headers["Content-Range"] = `*/${count}`;
    return new Response(req.method === "HEAD" ? null : JSON.stringify(payload), { status, headers });
  });
  const supabase = createSupabaseAdmin(
    { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
    fetchFn,
  );
  return { supabase, calls };
}

describe("buildQueue", () => {
  it("puts saved leads first and drops places sharing a contacted lead's phone", async () => {
    const { supabase, calls } = setup(({ method, url }) => {
      if (method === "HEAD") return { body: null, count: 3 };
      if (url.pathname.endsWith("/places")) {
        return {
          body: [
            { id: "place-2", ...PLACE, name: "Same phone as the saved lead", phones: ["0501112222"], lead: null },
            { id: "place-3", ...PLACE, name: "Contacted under another listing", phones: ["0509998888"], lead: null },
            { id: "place-4", ...PLACE, name: "Fresh", phones: ["0504445555"], lead: null },
          ],
        };
      }
      const status = url.searchParams.get("lead_status");
      if (status === "not.in.(new,reviewed)") return { body: [{ id: "x", place: { phones: ["+966 50 999 8888"] } }] };
      if (status === "in.(new,reviewed)") return { body: [LEAD] };
      return { body: [] }; // no follow-ups due
    });
    const queue = await buildQueue(supabase, { ...DEFAULT_QUEUE_QUERY, channel: "whatsapp", category: "food" }, 20);
    expect(queue.fresh.map((i) => i.placeId)).toEqual(["place-1", "place-4"]);
    expect(queue.fresh[0].lead?.id).toBe(LEAD_ID);
    expect(queue.fresh[1]).toMatchObject({ kind: "first", lead: null });
    expect(queue.contactedToday).toBe(3);

    const places = calls.find((c) => c.url.pathname.endsWith("/places"))!.url.searchParams;
    expect(places.get("lead")).toBe("is.null");
    expect(places.get("lead_score")).toBe("gte.60");
    expect(places.get("chain_size")).toBe("lt.3");
    expect(places.get("phones")).toBe("neq.{}");
    expect(places.get("basic_category")).toContain("cafe");
  });
});

describe("recordSent", () => {
  it("saves an unsaved place and marks it contacted", async () => {
    const { supabase, calls } = setup(({ method, url }) => {
      if (method === "HEAD") return { body: null, count: 2 };
      if (url.pathname.endsWith("/places")) return { body: { id: "place-1", name: "Basic Cafe", basic_category: "cafe", area: "jeddah" } };
      if (method === "POST") return { status: 201, body: { id: LEAD_ID } };
      if (method === "PATCH") return { body: [{ id: LEAD_ID }] };
      if (url.searchParams.get("overture_place_id")) return { body: null };
      return { body: LEAD };
    });
    const result = await recordSent(supabase, { placeId: "place-1" }, 20, new Date("2026-10-30T10:00:00Z"));
    expect(result.contactedToday).toBe(2);
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ lead_status: "contacted", follow_up_on: "2026-11-03" });
  });

  it("refuses new first messages once the daily limit is reached", async () => {
    const { supabase, calls } = setup(({ method }) => (method === "HEAD" ? { body: null, count: 20 } : { body: null }));
    await expect(recordSent(supabase, { placeId: "place-1" }, 20)).rejects.toBeInstanceOf(QueueLimitError);
    expect(calls.some((c) => c.method === "POST" || c.method === "PATCH")).toBe(false);
  });

  it("still allows follow-ups over the limit", async () => {
    const contacted = { ...LEAD, lead_status: "contacted", first_contacted_at: "2026-10-26T10:00:00Z" };
    const { supabase, calls } = setup(({ method }) => {
      if (method === "HEAD") return { body: null, count: 20 };
      if (method === "PATCH") return { body: [{ id: LEAD_ID }] };
      return { body: contacted };
    });
    await recordSent(supabase, { leadId: LEAD_ID }, 20, new Date("2026-10-30T10:00:00Z"));
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ lead_status: "follow_up", follow_up_count: 1 });
  });

  it("never records a message to an opted-out lead", async () => {
    const { supabase, calls } = setup(() => ({ body: { ...LEAD, lead_status: "do_not_contact" } }));
    await expect(recordSent(supabase, { leadId: LEAD_ID }, 20)).rejects.toBeInstanceOf(QueueBlockedError);
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });
});
