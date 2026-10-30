import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/leads/csv";
import { LEAD_STATUS_LABELS } from "@/lib/leads/leads";
import { parseLeadListQuery } from "@/lib/leads/listFilters";
import { listLeads } from "@/lib/server/leadsStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CSV of leads: operator data plus open-data place fields (storable and
// exportable with attribution, which the sources/licences columns carry).
// Contains no Google Places content.
export async function GET(request: NextRequest) {
  const parsed = parseLeadListQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });

  let leads;
  try {
    leads = await listLeads(getSupabaseAdmin(), parsed.query);
  } catch {
    return NextResponse.json({ ok: false, message: "Leads are unavailable." }, { status: 503 });
  }

  const csv = toCsv(
    [
      "label",
      "status",
      "category",
      "web_presence",
      "has_instagram",
      "phones",
      "websites",
      "socials",
      "notes",
      "website_url",
      "website_status",
      "website_checked_at",
      "first_contacted_at",
      "last_contacted_at",
      "lat",
      "lon",
      "area",
      "data_sources",
      "licenses",
    ],
    leads.map((lead) => [
      lead.label ?? lead.place?.name,
      LEAD_STATUS_LABELS[lead.lead_status],
      lead.place?.basic_category,
      lead.place?.web_presence,
      lead.place?.has_instagram,
      lead.place?.phones,
      lead.place?.websites,
      lead.place?.socials,
      lead.operator_notes,
      lead.website_url,
      lead.website_status,
      lead.website_checked_at,
      lead.first_contacted_at,
      lead.last_contacted_at,
      lead.place?.lat,
      lead.place?.lon,
      lead.place?.area,
      lead.place ? ["Overture Maps Foundation", ...lead.place.source_datasets] : [],
      lead.place?.source_licenses,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
