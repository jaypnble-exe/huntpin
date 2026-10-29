import { NextResponse } from "next/server";
import { getUsageStatus } from "@/lib/server/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getUsageStatus());
}
