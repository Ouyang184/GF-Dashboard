import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DashBoardControlService } from "@/generated/services/DashBoardControlService";

export type ControlPillar = "S" | "Q" | "D" | "I" | "P";
export type DashboardCommand = {
  id: number;
  command: "OpenPillar" | "CloseAll";
  target: ControlPillar | null;
  requestedAt: string;
};

const QUERY_KEY = ["dashboard-control"] as const;

function choice(value: unknown): string {
  if (value && typeof value === "object" && "Value" in value) {
    return String((value as { Value?: unknown }).Value ?? "");
  }
  return String(value ?? "");
}

async function loadLatestCommand(): Promise<DashboardCommand | null> {
  const result = await DashBoardControlService.getAll({ top: 100 });
  if (!result.success) throw result.error ?? new Error("Could not read Dashboard Control");
  const row = (result.data ?? [])
    .filter((item) => item.Active !== false)
    .sort((a, b) => Number(b.ID ?? 0) - Number(a.ID ?? 0))[0];
  if (!row) return null;
  const command = choice(row.Command);
  const target = choice(row.TargetPillar).toUpperCase();
  if (command !== "OpenPillar" && command !== "CloseAll") return null;
  return {
    id: Number(row.ID ?? 0),
    command,
    target: ["S", "Q", "D", "I", "P"].includes(target) ? target as ControlPillar : null,
    requestedAt: row.RequestedAt || row.Created || "",
  };
}

export function useLatestDashboardCommand() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadLatestCommand,
    refetchInterval: 1_000,
    refetchIntervalInBackground: true,
  });
  const acknowledge = useMutation({
    mutationFn: (id: number) => DashBoardControlService.update(String(id), { Active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  return { command: query.data ?? null, error: query.error, acknowledge: acknowledge.mutateAsync };
}

export function useDashboardRemote() {
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: async ({ command, target }: { command: DashboardCommand["command"]; target?: ControlPillar }) => {
      const result = await DashBoardControlService.create({
        Title: command === "CloseAll" ? "Close all pillars" : `Open ${target}`,
        Command: command,
        TargetPillar: target,
        RequestedAt: new Date().toISOString(),
        Active: true,
      });
      if (!result.success) throw result.error ?? new Error("Could not send dashboard command");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  return { send: send.mutateAsync, isSending: send.isPending, error: send.error };
}
