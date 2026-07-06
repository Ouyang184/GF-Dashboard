# Auto-pull MasterCards production from OneDrive Excel

Replace the randomly-generated MasterCards chart data with live counts from your `Mastercards_after_.xlsx` workbook in OneDrive. Each row in the sheet = one MasterCard. We count rows by month for the current fiscal year (Dec → Nov).

## What I still need from you (in the first build step)

You gave the OneDrive root, not the file link. Before I can call Excel, I need one of:

1. The **direct share link** to `Mastercards_after_.xlsx` (open the file in OneDrive → Share → Copy link), or
2. The **exact file path** inside your OneDrive (e.g. `/Documents/AMG/Mastercards_after_.xlsx`).

Also: the exact **sheet name** (e.g. `Sheet1`) and the header text of the **date column** (e.g. `Date`, `Completed`, `Timestamp`). If the "Mastercards" you mentioned is the sheet name and the date column is literally called `Date`, I'll use those.

## Steps

### 1. Link the Microsoft Excel connector
Trigger `standard_connectors--connect` for `microsoft_excel`. You sign in with the Microsoft account that owns the OneDrive file. This injects `LOVABLE_API_KEY` + `MICROSOFT_EXCEL_API_KEY` into the server runtime — no secrets in code.

Note: the connector reads as whichever account you sign in with. For a dashboard that shouldn't break when you leave, IT should give it a shared/service account later; we can swap the connection without code changes.

### 2. Resolve the file to a Graph `driveItemId` (one-off)
Using the link/path you provide, I do a single gateway call to Microsoft Graph to get the workbook's `itemId`, then store it as a secret (`EXCEL_MASTERCARDS_ITEM_ID`) so we don't re-resolve on every request.

### 3. Server function — `src/lib/mastercards.functions.ts`

```ts
export const getMastercardsByMonth = createServerFn({ method: "GET" })
  .handler(async () => {
    // 1. GET workbook usedRange bounds (cheap):
    //    /me/drive/items/{itemId}/workbook/worksheets/{sheet}/usedRange(valuesOnly=true)
    //      ?$select=address,rowCount,columnCount
    // 2. Page through the date column in ~2000-row chunks via
    //    range(address='A2:A2001') to avoid 504 timeouts on large sheets.
    // 3. Bucket dates by fiscal month (Dec..Nov of the current fiscal year).
    // Returns: { months: [{ month: "Dec", count: 1234 }, ...],
    //            ytdActual, sampledAt, fiscalYearStart }
  });
```

Defensive behavior:

- Retries on 429/503/504 with backoff (Graph times out on big sheets).
- If the gateway 401s, returns `{ error: "excel_unauthorized" }` so the card shows a "Reconnect Excel" hint instead of blanking.
- Reads only the date column, not the full sheet.

### 4. Client hook — `src/hooks/use-mastercards-production.ts`
TanStack Query, `refetchInterval: 5 * 60_000` (5 min), `staleTime: 60_000`. Exposes `{ months, ytdActual, sampledAt, error, isLoading }`.

### 5. Rewire `MastercardsProductionChart` in `src/routes/index.tsx`
Drop the `mulberry32` fake-data block. Feed `data` from the hook, keep the existing bar-chart rendering, target line, and YTD tiles untouched. Add a small "synced Xm ago · live from Excel" badge under the title, matching the InTouch sync badge style.

Target stays hardcoded at 120,000/month unless you later add a target column to the workbook.

### 6. Non-goals
- No write-back to Excel.
- No auth for dashboard viewers — they see whatever the linked Microsoft account can see.
- Other cards (Quote of the Day, QDIP, floor map) untouched.

## Order I'll do it in build mode

1. Ask for the file link + sheet/date-column names.
2. Trigger `microsoft_excel` connector connect → you sign in.
3. Resolve `itemId`, save as secret.
4. Write server fn + hook + wire chart in one pass, verify with a live fetch.
