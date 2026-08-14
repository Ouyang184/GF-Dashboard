import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DashboardTaskStatusRead } from "@/generated/models/DashboardTaskStatusModel";
import { DashboardTaskStatusService } from "@/generated/services/DashboardTaskStatusService";
import {
  fileAsDataUrl,
  uploadDashboardTaskPartImage,
} from "@/services/dashboard-task-attachments";

export type DashboardTask = {
  id: number;
  task: string;
  owner: string;
  due: string;
  taskType: "Escalation" | "LongTermAction" | "Top Issues";
  status: "Open" | "OverDue" | "Complete";
  detail: string;
  createdAt: string;
  taskKey: string;
  pillarKey: string;
  priority: number;
  problemStatement: string;
  rootCause: string;
  countermeasure: string;
  affectedPartNumber: string;
  partDescription: string;
  partImage: string;
  machine: string;
  completedDate: string;
};

export type DashboardTaskDraft = Omit<
  DashboardTask,
  | "id"
  | "status"
  | "detail"
  | "createdAt"
  | "taskKey"
  | "pillarKey"
  | "priority"
  | "problemStatement"
  | "rootCause"
  | "countermeasure"
  | "affectedPartNumber"
  | "partDescription"
  | "partImage"
  | "machine"
  | "completedDate"
> & { priority?: number };

const QUERY_KEY = ["dashboard-task-status"] as const;

function choice(value: unknown): string {
  if (value && typeof value === "object" && "Value" in value) {
    return String((value as { Value?: unknown }).Value ?? "");
  }
  return String(value ?? "");
}

function dateInput(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function normalize(row: DashboardTaskStatusRead): DashboardTask {
  const type = choice(row.Type_Of_Task);
  const status = choice(row.Status_Of_Task);
  const rawDetail = row.Detail?.trim() || "";
  const taskKey = rawDetail.match(/(?:^|\|)TaskKey:([^|]+)/)?.[1] || `legacy-${row.ID ?? 0}`;
  const pillarKey = rawDetail.match(/(?:^|\|)Pillar:([^|]+)/)?.[1] || "";
  const taskType: DashboardTask["taskType"] =
    type === "Top Issues" || type === "Top Issue"
      ? "Top Issues"
      : type === "LongTermAction" || type === "Long-Term Action" || type === "Long Term Action"
        ? "LongTermAction"
        : "Escalation";
  const priorityLimit = taskType === "LongTermAction" ? 10 : 5;
  const parsedPriority = Number.parseInt(row.Pillar?.trim() || "", 10);
  const fallbackPriority = taskType === "LongTermAction" ? 5 : 3;
  const priority = Number.isFinite(parsedPriority)
    ? Math.min(priorityLimit, Math.max(1, parsedPriority))
    : fallbackPriority;
  const partImageAttachment = [...(row["{Attachments}"] ?? [])]
    .filter((attachment) => {
      const name = attachment.DisplayName ?? "";
      return (
        name.startsWith("PartImage_") ||
        /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(name)
      );
    })
    .sort((a, b) => (a.DisplayName ?? "").localeCompare(b.DisplayName ?? ""))
    .at(-1);
  return {
    id: Number(row.ID ?? 0),
    task: row.Title?.trim() || "Untitled task",
    owner: row.Owner?.trim() || "—",
    due: dateInput(row.DueDate),
    taskType,
    status:
      status.toLowerCase() === "complete" || status.toLowerCase() === "completed"
        ? "Complete"
        : status === "OverDue" || status === "Overdue"
          ? "OverDue"
          : "Open",
    detail: rawDetail
      .replace(/(?:^|\|)TaskKey:[^|]+/, "")
      .replace(/(?:^|\|)Pillar:[^|]+/, "")
      .replace(/^\|+|\|+$/g, ""),
    createdAt: row.Task_Created_Date || row.Created || "",
    taskKey,
    pillarKey,
    priority,
    problemStatement: row.ProblemStatement?.trim() || "",
    rootCause: row.RootCause?.trim() || "",
    countermeasure: row.Countermeasure?.trim() || "",
    affectedPartNumber: row.AffectedPartNumber?.trim() || "",
    partDescription: row.PartDescription?.trim() || "",
    partImage: partImageAttachment?.AbsoluteUri?.trim() || "",
    machine: row.Machine?.trim() || "",
    completedDate: dateInput(row.CompletedDate),
  };
}

async function loadTasks(): Promise<DashboardTask[]> {
  const result = await DashboardTaskStatusService.getAll({ top: 500, orderBy: ["ID desc"] });
  if (!result.success) throw result.error ?? new Error("Could not read Dashboard Task Status");
  const latest = new Map<string, DashboardTask>();
  for (const task of (result.data ?? []).map(normalize).sort((a, b) => b.id - a.id)) {
    if (!latest.has(task.taskKey)) latest.set(task.taskKey, task);
  }
  return [...latest.values()].sort((a, b) => a.priority - b.priority || b.id - a.id);
}

function dueDate(value: string): string | undefined {
  return value ? new Date(`${value}T12:00:00`).toISOString() : undefined;
}

function buildDetail(pillarKey: string, taskKey: string, freeText: string): string {
  const tags = `Pillar:${pillarKey}|TaskKey:${taskKey}`;
  return freeText ? `${tags}|${freeText}` : tags;
}

function assertSuccess(result: { success: boolean; error?: unknown }): void {
  if (result.success) return;
  if (result.error instanceof Error) throw result.error;
  throw new Error("SharePoint task operation failed");
}

export function useDashboardTasks() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadTasks,
    refetchInterval: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const createMutation = useMutation({
    mutationFn: async ({ draft, pillarKey }: { draft: DashboardTaskDraft; pillarKey: string }) => {
      const priorityLimit = draft.taskType === "LongTermAction" ? 10 : 5;
      const priority = Math.min(
        priorityLimit,
        Math.max(1, draft.priority ?? (draft.taskType === "LongTermAction" ? 5 : 3)),
      );
      const result = await DashboardTaskStatusService.create({
        Title: draft.task,
        Owner: draft.owner,
        Task_Created_Date: new Date().toISOString(),
        DueDate: dueDate(draft.due),
        Detail: buildDetail(pillarKey, crypto.randomUUID(), ""),
        Pillar: String(priority),
      });
      assertSuccess(result);
      const newId = result.data?.ID;
      if (newId == null) return result.data ? normalize(result.data) : null;

      // This connector silently drops Choice-field values set during create
      // (Type_Of_Task/Status_Of_Task come back blank even though the rest of
      // the row saves) but the same fields persist reliably via update. Set
      // them in a follow-up call on the row we just created.
      const followUp = await DashboardTaskStatusService.update(String(newId), {
        Type_Of_Task: draft.taskType,
        Status_Of_Task: "Open",
        Pillar: String(priority),
      });
      assertSuccess(followUp);
      return followUp.data
        ? normalize(followUp.data)
        : result.data
          ? normalize(result.data)
          : null;
    },
    onSuccess: (created) => {
      if (created) {
        queryClient.setQueryData<DashboardTask[]>(QUERY_KEY, (current = []) => [
          created,
          ...current.filter((task) => task.taskKey !== created.taskKey),
        ]);
      }
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, 15_000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<DashboardTask> }) => {
      const existing = queryClient.getQueryData<DashboardTask[]>(QUERY_KEY)?.find((task) => task.id === id);
      if (!existing) throw new Error("Could not find the task to record its change");
      const next = { ...existing, ...patch };
      const priorityLimit = next.taskType === "LongTermAction" ? 10 : 5;
      next.priority = Math.min(priorityLimit, Math.max(1, next.priority));
      const result = await DashboardTaskStatusService.update(String(id), {
        Title: next.task,
        Type_Of_Task: next.taskType,
        Status_Of_Task: next.status,
        Owner: next.owner,
        DueDate: dueDate(next.due),
        Detail: buildDetail(existing.pillarKey, existing.taskKey, next.detail),
        Pillar: String(next.priority),
        ProblemStatement: next.problemStatement,
        RootCause: next.rootCause,
        Countermeasure: next.countermeasure,
        AffectedPartNumber: next.affectedPartNumber,
        PartDescription: next.partDescription,
        Machine: next.machine,
        CompletedDate: next.completedDate
          ? dueDate(next.completedDate)
          : (null as unknown as string),
      });
      assertSuccess(result);
      // The connector response can briefly contain the pre-update Choice
      // value. Preserve the status that was just successfully requested;
      // the delayed SharePoint refresh will verify the persisted value.
      return result.data
        ? { ...normalize(result.data), ...next }
        : next;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<DashboardTask[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<DashboardTask[]>(
        QUERY_KEY,
        previous.map((task) => task.id === id ? { ...task, ...patch } : task),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    // SharePoint is eventually consistent. An immediate refetch can return
    // the pre-update row and visually change OverDue back to Open even though
    // the update succeeded. Keep the optimistic value, then verify after
    // SharePoint has had time to expose the new choice value.
    onSuccess: (saved) => {
      queryClient.setQueryData<DashboardTask[]>(QUERY_KEY, (current = []) =>
        current.map((task) =>
          task.taskKey === saved.taskKey ? { ...task, ...saved } : task,
        ),
      );
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, 15_000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => DashboardTaskStatusService.delete(String(id)),
    onSuccess: refresh,
  });

  const partImageMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const [attachment, preview] = await Promise.all([
        uploadDashboardTaskPartImage(id, file),
        fileAsDataUrl(file),
      ]);
      return {
        id,
        // SharePoint can omit AbsoluteUri from the create response. Retain the
        // selected image until the attachment appears in the next list read.
        partImage: attachment.AbsoluteUri?.trim() || preview,
      };
    },
    onSuccess: ({ id, partImage }) => {
      if (partImage) {
        queryClient.setQueryData<DashboardTask[]>(QUERY_KEY, (current = []) =>
          current.map((task) => task.id === id ? { ...task, partImage } : task),
        );
      }
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, 15_000);
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isPending,
    error: query.error ?? createMutation.error ?? updateMutation.error ?? deleteMutation.error,
    createTask: (draft: DashboardTaskDraft, pillarKey: string) => createMutation.mutateAsync({ draft, pillarKey }),
    updateTask: (id: number, patch: Partial<DashboardTask>) => {
      const existing = query.data?.find((task) => task.id === id);
      const status = patch.status ?? existing?.status ?? "Open";
      const completedDate =
        patch.completedDate !== undefined
          ? patch.completedDate
          : patch.status === "Complete"
            ? existing?.completedDate || new Date().toISOString().slice(0, 10)
            : patch.status
              ? ""
              : existing?.completedDate;
      return updateMutation.mutateAsync({
        id,
        patch: {
          ...patch,
          taskType: patch.taskType ?? existing?.taskType ?? "Escalation",
          status,
          completedDate,
        },
      });
    },
    uploadPartImage: (id: number, file: File) =>
      partImageMutation.mutateAsync({ id, file }),
    // Preserve the SharePoint row as a task log entry. UI controls that still
    // call this legacy helper now complete the task instead of deleting it.
    deleteTask: (id: number) =>
      updateMutation.mutateAsync({
        id,
        patch: {
          status: "Complete",
          completedDate: new Date().toISOString().slice(0, 10),
        },
      }),
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      partImageMutation.isPending,
  };
}
