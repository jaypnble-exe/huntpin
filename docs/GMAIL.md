# Gmail: HUNTPIN label, drafts and reply check

Both parts are optional and free. HuntPin never sends email: you press Send yourself.

## 1. HUNTPIN label

Gmail doesn't run filters on email you send, and a BCC to yourself usually
isn't delivered as a separate copy, so a BCC + filter can't label sent mail.
Instead, connect Gmail (part 2) and press **Sync with Gmail** (Leads page or
Templates page) after sending. HuntPin searches your Sent mail for emails to
leads contacted in the last 60 days and puts those conversations under HUNTPIN.

`OUTREACH_BCC` is still available if you want a BCC copy for another mail app.

Tip: to make the Email buttons open Gmail instead of another mail app, open
Gmail in Chrome, click the handler icon at the right of the address bar and
choose Allow.

## 2. Connect Gmail (drafts + reply check)

When connected:

- Each draft gets a **Gmail draft** button. It saves the message in your Gmail
  drafts (labelled HUNTPIN) and gives you an **Open draft in Gmail** link. You
  review it and press Send in Gmail.
- **Sync with Gmail** (Leads page and Templates page) finds emails you sent to
  recently contacted leads (Sent mail search, ids only), labels them HUNTPIN,
  and checks those conversations for replies, reading only labels and the From
  header. Leads that were contacted and got a reply move to **Replied**.
  Automatic replies and bounces are ignored. The **Replies** page lists every
  business that replied, newest first, with Open in Gmail and Open lead. It runs only when you click it:
  at most 30 searches and 25 conversations per click.

HuntPin asks Google for one permission, `gmail.modify` (create drafts, apply
labels, read message headers). It's needed to put the HUNTPIN label on drafts
and conversations. Google's wording for it is broad (it could also read and
send mail), but HuntPin's code has no send call and asks Gmail only for labels
and the From header, never message text. A narrower option is
`gmail.compose` + `gmail.metadata`, with the label coming from the BCC filter
only. The token is stored encrypted in Supabase with
`GMAIL_TOKEN_KEY`, which only the server knows. Disconnect on the Templates page
revokes it.

### Setup (once, about 10 minutes, no billing needed)

1. Go to https://console.cloud.google.com and create a project (e.g. "HuntPin").
   Don't add a billing account; it isn't needed.
2. APIs & Services → Library → **Gmail API** → Enable.
3. APIs & Services → OAuth consent screen (Google Auth Platform):
   - User type **External**. App name "HuntPin", your email as support and
     developer contact.
   - Data access / Scopes: add `https://www.googleapis.com/auth/gmail.modify`.
   - Audience: add your Gmail address as a **test user**.
4. Clients → Create client → **Web application**. Authorized redirect URIs:
   - `https://huntpin.vercel.app/api/gmail/callback`
   - `http://localhost:3300/api/gmail/callback` (for local use)
   Copy the client ID and client secret.
5. Create the encryption key: `npm run gmail:key`.
6. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_TOKEN_KEY` in
   `.env.local` and in Vercel (Production), then redeploy.
7. Run `supabase/migrations/011_gmail.sql` in the Supabase SQL Editor.
8. Open Templates → Gmail → **Connect Gmail**. Google will warn that the app
   isn't verified: it's your own app, so choose Continue.

### Staying connected

While the app is in **Testing** on Google's Audience page, Google ends the
connection after 7 days and you press Connect Gmail again. To avoid that, press
**Publish app** there. For an app only you use, Google's verification isn't
required; you keep seeing the "unverified app" warning when you connect.

If `GMAIL_TOKEN_KEY` changes, the stored token can't be read: connect again.
