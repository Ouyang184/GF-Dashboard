## Answers to your two questions first

- **Yes, this can connect to SharePoint.** Lovable ships a Microsoft SharePoint connector that goes through Microsoft Graph. We link it once, sign in with the Microsoft account whose SharePoint you want to read (your company account), and the app queries the list from a server function. No SharePoint credentials ever live in the codebase.
- **Running locally vs. hosted makes no difference for auth.** The connector stores your Microsoft OAuth tokens on Lovable's side and injects two env vars (`LOVABLE_API_KEY` + `MICROSOFT_SHAREPOINT_API_KEY`) into the server runtime. Local `bun dev`, Lovable preview, and the published site all read the same tokens and hit the same gateway. Local only becomes a problem if your company's SharePoint is behind a VPN/Conditional Access rule that blocks non-corporate IPs — that would block Lovable's servers too, and would need IT to allow the Lovable gateway.

**Important caveat on the account:** the connector authenticates as *one* Microsoft account (the one you sign in with when linking). For a company dashboard the right move is to sign in with a **shared/service account** your IT owns (e.g. `amg-dashboard@yourco.com`) that has read access to the SharePoint list — not your personal login. Otherwise the dashboard breaks the day you leave or your password rotates. If you don't have one yet, we can start with your company account to prove it works, then swap the connection to a service account later without code changes.

## What I need from you before building

1. **Confirm the connector link.** I'll trigger the connect flow for `microsoft_sharepoint`; you sign in with the company (or service) account.
2. **SharePoint site + list identity.** Paste the SharePoint URL of the list — something like `https://<tenant>.sharepoint.com/sites/<site>/Lists/<ListName>`. I'll resolve it to the Graph `siteId` and `listId`.
3. **Column mapping.** Tell me which list columns hold:
   - Machine ID (matching IDs like `310IM30`, `419AM0`, …)
   - Deviation status or severity (or just "a row = a deviation")
   - Timestamp / "date opened"
   - Optional: "is open" / "resolved" flag so we ignore closed items

We'll only count deviations dated **today** (America/Chicago) that are still open.

## What I'll build

### 1. Server function — `src/lib/sharepoint-deviations.functions.ts`

```ts
export const getTodaysDeviations = createServerFn({ method: "GET" })
  .handler(async () => {
    // GET {GATEWAY}/microsoft_sharepoint/sites/{siteId}/lists/{listId}/items?expand=fields
    //   &$filter=fields/DateOpened ge 'YYYY-MM-DDT00:00:00Z' and fields/Status ne 'Closed'
    // Auth headers:
    //   Authorization: Bearer ${LOVABLE_API_KEY}
    //   X-Connection-Api-Key: ${MICROSOFT_SHAREPOINT_API_KEY}
    // Returns { deviations: [{ machineId, status, note }], sampledAt }
  });
```

- Site + list IDs read from env vars (`SHAREPOINT_SITE_ID`, `SHAREPOINT_LIST_ID`) which I'll store via `add_secret` after you confirm the URL — that way we can point at a different list without a redeploy.
- Explicit error handling: if the gateway 401s, return `{ deviations: [], error: "sharepoint_unauthorized" }` so the UI shows a "Reconnect SharePoint" hint instead of blanking the dashboard.

### 2. Client hook — `src/hooks/use-sharepoint-deviations.ts`

- Uses TanStack Query, `refetchInterval: 60_000` (1 min), `staleTime: 30_000`.
- Exposes `{ count, byMachine, sampledAt, error, isLoading }`.

### 3. Wire into the existing rule

Replace `useDeviationCount()` (which reads local tile clicks) with the SharePoint count for the QDIP dots, keeping the same thresholds:

- Inventory today red when `count >= 1`
- Delivery today red when `count > 3`

Manual tile clicking on the floor map stays as a manual override for anything not yet in the SharePoint list — it just OR's with the SharePoint count so nothing regresses.

### 4. Small UI additions inside the Productivity pillar overlay

- Under the tree card: "SharePoint deviations today: N · synced Xs ago" badge, with a "Reconnect" link when `error === "sharepoint_unauthorized"`.
- Red tint on the machine tile whose ID matches an open deviation row.

### 5. Non-goals in this pass

- No write-back to SharePoint (that was option 3 in the earlier question and you picked read-only).
- No per-viewer Microsoft login. Dashboard viewers see whatever the connected account can see.

## Order of operations

1. You approve this plan.
2. I trigger `standard_connectors--connect` for Microsoft SharePoint → you sign in with the company/service account.
3. You paste the list URL + column names.
4. I resolve `siteId`/`listId` via a one-off gateway call, save both as secrets, then write the server fn, hook, and UI wiring in one pass.
