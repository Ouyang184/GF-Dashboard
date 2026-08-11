import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DashboardDateStatusRead } from "@/generated/models/DashboardDateStatusModel";
import { DashboardDateStatusService } from "@/generated/services/DashboardDateStatusService";
import type { DayHistoryPillarKey, DayStatus } from "@/hooks/use-pillar-day-history";

const QUERY_KEY = ["dashboard-date-status"] as const;
const SAVING_TITLES = new Set<string>();
const PILLAR_NAMES: Record<DayHistoryPillarKey, string> = {
  S: "Safety",
  Q: "Quality",
  D: "Process Deviation",
  I: "Product Deviation",
  P: "Productivity",
};
const PILLAR_KEYS = Object.fromEntries(
  Object.entries(PILLAR_NAMES).map(([key, name]) => [name.toLowerCase(), key]),
) as Record<string, DayHistoryPillarKey>;
const STATUS_TO_COLOR: Record<DayStatus, string> = {
  ok: "Green",
  warn: "Yellow",
  fail: "Red",
};
const MANUAL_DETAILS = "Manual dashboard edit";
const SAFETY_INCIDENTS_PREFIX = "Safety incidents:";

function safetyIncidentsFromDetails(details: string | undefined): number | null {
  const match = details?.match(/Safety incidents:\s*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function statusFromColor(value: string | undefined): DayStatus | null {
  switch ((value ?? "").trim().toLowerCase()) {
    case "green": return "ok";
    case "yellow": return "warn";
    case "red": return "fail";
    default: return null;
  }
}

async function loadRows(): Promise<DashboardDateStatusRead[]> {
  const result = await DashboardDateStatusService.getAll({
    top: 1000,
    // The pillar calendars display the current and previous months. Reading
    // newest-first ensures those dates remain in the result even as history
    // grows beyond SharePoint's requested row limit.
    orderBy: ["StatusDate desc", "ID desc"],
  });
  if (!result.success) {
    throw result.error ?? new Error("Could not read Dashboard Date Status from SharePoint");
  }
  return result.data ?? [];
}

export type DashboardDateHistories = Record<
  DayHistoryPillarKey,
  Record<string, DayStatus>
>;

export function useDashboardDateStatus(
  day: string,
  liveStatuses: Partial<Record<DayHistoryPillarKey, DayStatus | null>>,
): DashboardDateHistories {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadRows,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });

  const histories = useMemo<DashboardDateHistories>(() => {
    const next: DashboardDateHistories = { S: {}, Q: {}, D: {}, I: {}, P: {} };
    const manualOverrides = new Set<string>();
    for (const row of query.data ?? []) {
      const pillar = PILLAR_KEYS[(row.Pillar ?? "").trim().toLowerCase()];
      const date = (row.StatusDate ?? "").slice(0, 10);
      const status = statusFromColor(row.StatusColor);
      const isManual = (row.Details ?? "").toLowerCase().includes(MANUAL_DETAILS.toLowerCase());
      // Quality is a weekly manual input. Ignore legacy automatic Quality
      // rows so a day does not appear colored before Monday is explicitly set.
      if (pillar === "Q" && !isManual) continue;
      // Automatic Process/Product/Productivity rows are final only after the
      // complete 7 AM–7 AM production window. The `day` argument is the most
      // recently completed date, so hide legacy premature rows after it.
      if (
        !isManual &&
        (pillar === "D" || pillar === "I" || pillar === "P") &&
        date > day
      ) continue;
      if (pillar && date && status) {
        next[pillar][date] = status;
        if (isManual) {
          manualOverrides.add(`${pillar}|${date}`);
        }
      }
    }
    for (const [pillar, status] of Object.entries(liveStatuses)) {
      if (day && status && !manualOverrides.has(`${pillar}|${day}`)) {
        next[pillar as DayHistoryPillarKey][day] = status;
      }
    }
    return next;
  }, [day, liveStatuses, query.data]);

  useEffect(() => {
    if (!day || !query.data) return;
    const writes: Promise<unknown>[] = [];
    for (const [pillarKey, status] of Object.entries(liveStatuses)) {
      if (!status) continue;
      const key = pillarKey as DayHistoryPillarKey;
      const title = `${PILLAR_NAMES[key]}-${day}`;
      const color = STATUS_TO_COLOR[status];
      const counts = {
        OkCount: status === "ok" ? 1 : 0,
        WarningCount: status === "warn" ? 1 : 0,
        MissCount: status === "fail" ? 1 : 0,
      };
      const existingRows = query.data.filter(
        (row) => (row.Title ?? "").trim().toLowerCase() === title.toLowerCase(),
      );
      if (
        existingRows.some(
          (row) => (row.Details ?? "").toLowerCase().includes(MANUAL_DETAILS.toLowerCase()),
        )
      ) {
        continue;
      }
      const allCurrent = existingRows.length > 0 && existingRows.every(
        (row) =>
          row.StatusColor?.trim().toLowerCase() === color.toLowerCase() &&
          row.OkCount === counts.OkCount &&
          row.WarningCount === counts.WarningCount &&
          row.MissCount === counts.MissCount,
      );
      if (allCurrent || SAVING_TITLES.has(title)) continue;
      SAVING_TITLES.add(title);
      const lastCalculated = new Date().toISOString();
      const write = existingRows.length
        ? Promise.all(
            existingRows
              .filter((row) => row.ID != null)
              .map((row) =>
                DashboardDateStatusService.update(String(row.ID), {
                  StatusColor: color,
                  ...counts,
                  LastCalculated: lastCalculated,
                }),
              ),
          )
        : DashboardDateStatusService.create({
            Title: title,
            Pillar: PILLAR_NAMES[key],
            StatusDate: day,
            StatusColor: color,
            ...counts,
            LastCalculated: lastCalculated,
          });
      writes.push(write.finally(() => SAVING_TITLES.delete(title)));
    }
    if (writes.length) {
      void Promise.allSettled(writes).then(() =>
        queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      );
    }
  }, [day, liveStatuses, query.data, queryClient]);

  return histories;
}

export function useDashboardDateStatusEditor() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      pillar,
      day,
      status,
    }: {
      pillar: DayHistoryPillarKey;
      day: string;
      status: DayStatus;
    }) => {
      // Always check the real SharePoint rows here. The query cache may contain
      // the temporary optimistic row added by onMutate, which has no ID and
      // must never be mistaken for an existing SharePoint record.
      const rows = await loadRows();
      const title = `${PILLAR_NAMES[pillar]}-${day}`;
      const color = STATUS_TO_COLOR[status];
      const counts = {
        OkCount: status === "ok" ? 1 : 0,
        WarningCount: status === "warn" ? 1 : 0,
        MissCount: status === "fail" ? 1 : 0,
      };
      const matching = rows.filter((row) => {
        const titleMatches = (row.Title ?? "").trim().toLowerCase() === title.toLowerCase();
        const pillarMatches =
          (row.Pillar ?? "").trim().toLowerCase() === PILLAR_NAMES[pillar].toLowerCase();
        const dateMatches = (row.StatusDate ?? "").slice(0, 10) === day;
        return titleMatches || (pillarMatches && dateMatches);
      });
      const savedIncidentCount = matching
        .map((row) => safetyIncidentsFromDetails(row.Details))
        .find((value) => value != null);
      const values = {
        Title: title,
        Pillar: PILLAR_NAMES[pillar],
        StatusDate: day,
        StatusColor: color,
        ...counts,
        Details: savedIncidentCount == null
          ? MANUAL_DETAILS
          : `${MANUAL_DETAILS} | ${SAFETY_INCIDENTS_PREFIX} ${savedIncidentCount}`,
        LastCalculated: new Date().toISOString(),
      };
      if (matching.length) {
        const results = await Promise.all(
          matching
            .filter((row) => row.ID != null)
            .map((row) => DashboardDateStatusService.update(String(row.ID), values)),
        );
        const failed = results.find((result) => !result.success);
        if (failed) {
          throw failed.error ?? new Error("SharePoint could not update the date status");
        }
      } else {
        const result = await DashboardDateStatusService.create(values);
        if (!result.success) {
          throw result.error ?? new Error("SharePoint could not create the date status");
        }
      }
      return { pillar, day, status };
    },
    onMutate: async ({ pillar, day, status }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<DashboardDateStatusRead[]>(QUERY_KEY);
      const title = `${PILLAR_NAMES[pillar]}-${day}`;
      const color = STATUS_TO_COLOR[status];
      const optimistic: DashboardDateStatusRead = {
        Title: title,
        Pillar: PILLAR_NAMES[pillar],
        StatusDate: day,
        StatusColor: color,
        OkCount: status === "ok" ? 1 : 0,
        WarningCount: status === "warn" ? 1 : 0,
        MissCount: status === "fail" ? 1 : 0,
        Details: MANUAL_DETAILS,
      };
      queryClient.setQueryData<DashboardDateStatusRead[]>(QUERY_KEY, (current = []) => {
        const without = current.filter(
          (row) =>
            !(
              (row.Pillar ?? "").trim().toLowerCase() === PILLAR_NAMES[pillar].toLowerCase() &&
              (row.StatusDate ?? "").slice(0, 10) === day
            ),
        );
        return [...without, optimistic];
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      // SharePoint can briefly return the pre-update row immediately after a
      // successful write. Keep the optimistic color visible, then verify it
      // after the list has had time to become consistent.
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, 3_000);
    },
  });

  return {
    setStatus: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}

export function useSafetyIncidentEditor() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadRows,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });
  const history = useMemo<Record<string, number>>(() => {
    const values: Record<string, number> = {};
    for (const row of query.data ?? []) {
      if ((row.Pillar ?? "").trim().toLowerCase() !== "safety") continue;
      const day = (row.StatusDate ?? "").slice(0, 10);
      const count = safetyIncidentsFromDetails(row.Details);
      if (day && count != null) values[day] = count;
    }
    return values;
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async ({ day, count }: { day: string; count: number }) => {
      const rows = await loadRows();
      const title = `Safety-${day}`;
      const matching = rows.filter((row) => {
        const titleMatches = (row.Title ?? "").trim().toLowerCase() === title.toLowerCase();
        const pillarMatches = (row.Pillar ?? "").trim().toLowerCase() === "safety";
        const dateMatches = (row.StatusDate ?? "").slice(0, 10) === day;
        return titleMatches || (pillarMatches && dateMatches);
      });
      const manual = matching.some((row) =>
        (row.Details ?? "").toLowerCase().includes(MANUAL_DETAILS.toLowerCase()),
      );
      const details = `${manual ? `${MANUAL_DETAILS} | ` : ""}${SAFETY_INCIDENTS_PREFIX} ${count}`;
      if (matching.length) {
        const results = await Promise.all(
          matching
            .filter((row) => row.ID != null)
            .map((row) => DashboardDateStatusService.update(String(row.ID), { Details: details })),
        );
        const failed = results.find((result) => !result.success);
        if (failed) throw failed.error ?? new Error("Could not save the Safety incident count");
      } else {
        const result = await DashboardDateStatusService.create({
          Title: title,
          Pillar: "Safety",
          StatusDate: day,
          StatusColor: count > 0 ? "Red" : "Green",
          OkCount: count > 0 ? 0 : 1,
          WarningCount: 0,
          MissCount: count > 0 ? 1 : 0,
          Details: details,
          LastCalculated: new Date().toISOString(),
        });
        if (!result.success) throw result.error ?? new Error("Could not save the Safety incident count");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    history,
    setIncidents: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
