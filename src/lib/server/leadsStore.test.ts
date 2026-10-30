import { describe, expect, it, vi } from "vitest";
import { createLeadFromPlace, isValidLeadId, listLeads, updateLead } from "./leadsStore";
import { createSupabaseAdmin } from "./supabase";

const LEAD_ID = "3f1c7a52-8f0e-4b8a-9d55-0c2a1f6e4b10";
const LEAD = {
  id: LEAD_ID,
  label: "Basic Cafe",
  operator_notes: null,
  lead_status: "new",
  first_contacted_at: null,
  last_contacted_at: null,
  created_at: "2026-10-30T00:00:00Z",
  updated_at: "2026-10-30T00:00:00Z",
  overture_place_id: "place-1",
  follow_up_on: null,
  follow_up_count: 0,
  place: null,
};

type Handler = (req: { method: string; url: URL; body: unknown }) => { status?: number; body: unknown };

function setup(handler: Handler) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const fetchFn = vi.fn<typeof fetch>(async (input, init) => {
    const req = {
      method: init?.method ?? "GET",
      url: new URL(String(input)),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(req);
    const { status = 200, body } = handler(req);
    // single()/maybeSingle() ask for one object; others get an array.
    const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object");
    const payload = wantsObject || status >= 400 ? body : Array.isArray(body) ? body : body === null ? [] : [body];
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  });
  const supabase = createSupabaseAdmin(
    { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
    fetchFn,
  );
  return { supabase, calls };
}

describe("createLeadFromPlace", () => {
  it("creates a lead labelled with the place name", async () => {
    const { supabase, calls } = setup(({ method, url }) => {
      if (url.pathname.endsWith("/places")) return { body: { id: "place-1", name: "Basic Cafe", basic_category: "cafe", area: "Jeddah" } };
      if (method === "POST") return { status: 201, body: { id: LEAD_ID } };
      return { body: LEAD };
    });
    const result = await createLeadFromPlace(supabase, "place-1");
    expect(result.created).toBe(true);
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      overture_place_id: "place-1",
      label: "Basic Cafe",
      search_niche: "cafe",
      search_location: "Jeddah",
    });
  });

  it("returns the existing lead instead of creating a duplicate", async () => {
    const { supabase } = setup(({ method, url }) => {
      if (url.pathname.endsWith("/places")) return { body: { id: "place-1", name: "Basic Cafe", basic_category: "cafe", area: "Jeddah" } };
      if (method === "POST") return { status: 409, body: { code: "23505", message: "duplicate key" } };
      return { body: LEAD };
    });
    const result = await createLeadFromPlace(supabase, "place-1");
    expect(result).toEqual({ lead: LEAD, created: false });
  });

  it("reports a missing place", async () => {
    const { supabase } = setup(() => ({ body: null }));
    await expect(createLeadFromPlace(supabase, "nope")).rejects.toThrow("place_not_found");
  });
});

describe("updateLead", () => {
  it("mark contacted sets both dates and moves a new lead to contacted", async () => {
    const now = new Date("2026-10-30T10:00:00Z");
    const { supabase, calls } = setup(({ method }) => (method === "PATCH" ? { body: [{ id: LEAD_ID }] } : { body: LEAD }));
    await updateLead(supabase, LEAD_ID, { operator_notes: "Sent intro" }, true, now);
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      operator_notes: "Sent intro",
      last_contacted_at: now.toISOString(),
      first_contacted_at: now.toISOString(),
      lead_status: "contacted",
      follow_up_count: 0,
      // 4 days after 30 Oct in Riyadh time.
      follow_up_on: "2026-11-03",
    });
  });

  it("keeps the first contact date and an explicit status", async () => {
    const now = new Date("2026-11-02T10:00:00Z");
    const contacted = { ...LEAD, lead_status: "contacted", first_contacted_at: "2026-10-30T10:00:00Z" };
    const { supabase, calls } = setup(({ method }) => (method === "PATCH" ? { body: [{ id: LEAD_ID }] } : { body: contacted }));
    await updateLead(supabase, LEAD_ID, { lead_status: "follow_up" }, true, now);
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      lead_status: "follow_up",
      last_contacted_at: now.toISOString(),
      follow_up_count: 1,
      follow_up_on: "2026-11-06",
    });
  });

  it("clears the reminder when a lead replies or opts out", async () => {
    const { supabase, calls } = setup(({ method }) => (method === "PATCH" ? { body: [{ id: LEAD_ID }] } : { body: LEAD }));
    await updateLead(supabase, LEAD_ID, { lead_status: "do_not_contact" }, false);
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ lead_status: "do_not_contact", follow_up_on: null });
  });

  it("reports a missing lead", async () => {
    const { supabase } = setup(({ method }) => (method === "PATCH" ? { body: [] } : { body: null }));
    await expect(updateLead(supabase, LEAD_ID, { label: "x" }, false)).rejects.toThrow("lead_not_found");
  });
});

describe("listLeads", () => {
  it("uses an inner join only when filtering on the place", async () => {
    const { supabase, calls } = setup(() => ({ body: [] }));
    await listLeads(supabase, { statuses: ["new"], presence: [], category: null });
    await listLeads(supabase, { statuses: [], presence: ["social_only"], category: "food" });
    await listLeads(supabase, { statuses: [], presence: [], category: null, due: true });

    const [plain, joined, due] = calls.map((c) => c.url.searchParams);
    expect(due.get("follow_up_on")).toMatch(/^lte\.\d{4}-\d{2}-\d{2}$/);
    expect(due.get("lead_status")).toBe("in.(contacted,follow_up)");
    expect(plain.get("select")).toContain("place:places(");
    expect(plain.get("lead_status")).toBe("in.(new)");
    expect(joined.get("select")).toContain("place:places!inner(");
    expect(joined.get("place.web_presence")).toBe("in.(social_only)");
    expect(joined.get("place.basic_category")).toContain("restaurant");
    expect(joined.get("order")).toBe("updated_at.desc");
  });
});

describe("isValidLeadId", () => {
  it("accepts UUIDs only", () => {
    expect(isValidLeadId(LEAD_ID)).toBe(true);
    expect(isValidLeadId("1; drop table")).toBe(false);
  });
});
