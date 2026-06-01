This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run the app and support chat agent together (one command, one browser port):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The support chatbot talks to LangGraph through the same origin at `/api/langgraph` (proxied to the agent on port `2024`).

To run only the Next.js app or only the agent:

```bash
npm run dev:web
npm run dev:agent
```

Optional env (defaults work for local dev):

```env
# Browser URL for LangGraph SDK (default: http://localhost:3000/api/langgraph)
# NEXT_PUBLIC_LANGGRAPH_API_URL=

# Where the Next.js proxy forwards requests (default: http://127.0.0.1:2024)
# LANGGRAPH_INTERNAL_URL=http://127.0.0.1:2024
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Google Drive Permission Revoked (Attendance `invalid_grant`)

Attendance and punch APIs use Google Drive OAuth tokens. If token access is revoked or expired, punch/attendance endpoints can fail with:

- `invalid_grant`
- `GET /api/attendance 500`
- `GET /api/attendance/corrections 500`

### Quick Recovery Flow

1. Open Google Drive integration page in the app:
   - [http://localhost:3000/integrations/google-drive](http://localhost:3000/integrations/google-drive)
2. Click **Connect Google Drive**.
   - If button is not visible, open auth directly:
   - [http://localhost:3000/api/integrations/google-drive/auth](http://localhost:3000/api/integrations/google-drive/auth)
3. Complete Google consent flow (**Continue** → **Allow**).
4. Confirm redirect includes `connected=1`:
   - `http://localhost:3000/integrations/google-drive?connected=1`
5. Re-test punch page:
   - [http://localhost:3000/employee/punch](http://localhost:3000/employee/punch)

### Verify Integration Status

Open:

- [http://localhost:3000/api/integrations/google-drive/status](http://localhost:3000/api/integrations/google-drive/status)

Expected values:

- `oauthConfigured: true`
- `oauthConnected: true` (after successful connect)

### If `oauthConfigured` is `false`

Add OAuth env vars and restart dev server:

```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/google-drive/callback
```

### If still failing after reconnect

- Ensure you approved consent with the same Google account used for HRM Drive files.
- Delete stale local token cache and reconnect:
  - `.data/google-drive-oauth.json`
- Recheck status endpoint and retry punch/attendance.
