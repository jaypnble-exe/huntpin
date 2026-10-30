// Outreach drafts. Drafts only: nothing here sends a message. The operator
// edits, copies, and sends each one manually.

// Default message from CLAUDE.md. Do not add business-specific claims here;
// only mention a website issue if it was actually checked.
export const DEFAULT_OUTREACH_MESSAGE = `Hi! 👋 I came across your business on Google Maps and wanted to reach out.

I’m a web and mobile app developer, and I help businesses build and improve websites, develop custom systems and mobile applications, and implement AI automations to streamline their operations.

I was wondering if you have any digital projects, website improvements, or automation ideas that you’d like to explore. I’d be happy to discuss how I could help!

Would you be open to a quick chat? 😊`;

/**
 * Opens WhatsApp with the draft pre-filled for one recipient. The operator
 * still reviews and presses send; nothing is sent automatically.
 */
export function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
