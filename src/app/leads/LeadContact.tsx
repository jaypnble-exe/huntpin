import { SocialLinks } from "@/components/leads/SocialLinks";
import { ExternalButtonLink, IconMail, IconMessage, IconPhone, Section, buttonClasses } from "@/components/ui";
import { whatsappHref } from "@/lib/leads/outreach";
import { mailtoHref } from "@/lib/places/emails";
import { telHref } from "@/lib/places/links";

/**
 * Listed ways to reach the business, one row each. These open the operator's
 * own phone, WhatsApp or mail app without a message; the draft below has
 * the buttons that fill it in.
 */
export function LeadContact({ phones, emails, links }: { phones: string[]; emails: string[]; links: string[] }) {
  const phoneRows = phones.map((phone) => ({ phone, tel: telHref(phone), chat: whatsappHref(phone, "") }));
  const emailRows = emails.map((email) => ({ email, href: mailtoHref(email) })).filter((row) => row.href !== null);
  const hasLinks = links.some((url) => url.trim() !== "");

  return (
    <Section title="Contact">
      {phoneRows.length === 0 && emailRows.length === 0 && !hasLinks ? (
        <p className="text-sm text-muted">No phone, email or profile listed.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {phoneRows.map(({ phone, tel, chat }) => (
            <li key={phone} className="flex items-center gap-2 px-3 py-2">
              <IconPhone className="h-4 w-4 shrink-0 text-muted" />
              <span dir="ltr" className="min-w-0 flex-1 truncate text-sm tabular-nums">
                {phone}
              </span>
              {tel && (
                <a href={tel} className={buttonClasses({ size: "sm" })} aria-label={`Call ${phone}`}>
                  Call
                </a>
              )}
              {chat && (
                <ExternalButtonLink
                  size="sm"
                  href={chat}
                  title="Opens an empty WhatsApp chat. To send the draft, use WhatsApp under Outreach draft."
                >
                  <IconMessage />
                  WhatsApp
                </ExternalButtonLink>
              )}
            </li>
          ))}
          {emailRows.map(({ email, href }) => (
            <li key={email} className="flex items-center gap-2 px-3 py-2">
              <IconMail className="h-4 w-4 shrink-0 text-muted" />
              <span dir="ltr" title={email} className="min-w-0 flex-1 truncate text-sm">
                {email}
              </span>
              <a href={href!} className={buttonClasses({ size: "sm" })} aria-label={`Email ${email}`}>
                Email
              </a>
            </li>
          ))}
          {hasLinks && (
            <li className="px-3 py-2.5">
              <SocialLinks urls={links} />
            </li>
          )}
        </ul>
      )}
    </Section>
  );
}
