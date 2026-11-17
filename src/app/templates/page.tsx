import { TemplatesEditor } from "./TemplatesEditor";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { gmail } = await searchParams;
  return <TemplatesEditor gmailOutcome={typeof gmail === "string" ? gmail : null} />;
}
