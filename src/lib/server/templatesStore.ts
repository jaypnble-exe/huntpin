import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeTemplates, type OutreachTemplates } from "../leads/outreach";

// Edited message templates live in app_settings as one JSON value.
const KEY = "outreach_templates";

export async function getTemplates(supabase: SupabaseClient): Promise<{ templates: OutreachTemplates; customized: boolean }> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw new Error("templates_read_failed");
  if (!data) return { templates: mergeTemplates(null), customized: false };
  let stored: unknown = null;
  try {
    stored = JSON.parse(data.value);
  } catch {
    stored = null; // Damaged value: fall back to the defaults.
  }
  return { templates: mergeTemplates(stored), customized: true };
}

export async function saveTemplates(supabase: SupabaseClient, templates: OutreachTemplates): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: JSON.stringify(templates), updated_at: new Date().toISOString() });
  if (error) throw new Error("templates_write_failed");
}

export async function resetTemplates(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("app_settings").delete().eq("key", KEY);
  if (error) throw new Error("templates_write_failed");
}
