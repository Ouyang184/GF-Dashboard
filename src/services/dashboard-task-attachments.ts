import { getClient } from "@microsoft/power-apps/data";

import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo";

const DATA_SOURCE_NAME = "dashboard task status";

type SharePointAttachment = {
  Id?: string;
  ID?: string;
  AbsoluteUri?: string;
  DisplayName?: string;
};

const attachmentDataSourcesInfo = {
  ...dataSourcesInfo,
  [DATA_SOURCE_NAME]: {
    ...dataSourcesInfo[DATA_SOURCE_NAME],
    apis: {
      ...dataSourcesInfo[DATA_SOURCE_NAME].apis,
      CreateAttachment: {
        path: "/{connectionId}/datasets/{dataset}/tables/{tableName}/items/{itemId}/attachments",
        method: "POST",
        parameters: [
          {
            name: "connectionId",
            in: "path",
            required: true,
            type: "string",
          },
          {
            name: "dataset",
            in: "path",
            required: true,
            type: "string",
          },
          {
            name: "tableName",
            in: "path",
            required: true,
            type: "string",
          },
          {
            name: "itemId",
            in: "path",
            required: true,
            type: "integer",
          },
          {
            name: "displayName",
            in: "query",
            required: true,
            type: "string",
          },
          {
            name: "body",
            in: "body",
            required: true,
            type: "string",
            format: "binary",
          },
        ],
        responseInfo: {
          "200": {
            type: "object",
          },
          "201": {
            type: "object",
          },
        },
      },
    },
  },
};

const client = getClient(
  attachmentDataSourcesInfo as Parameters<typeof getClient>[0],
);

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected image"));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const separator = value.indexOf(",");
      if (separator < 0) {
        reject(new Error("Could not encode the selected image"));
        return;
      }
      resolve(value.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

function attachmentName(file: File): string {
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  return `PartImage_${new Date().toISOString().replace(/[:.]/g, "-")}_${safeName || "image"}`;
}

function operationError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message?: unknown }).message ?? "SharePoint image upload failed"));
  }
  return new Error("SharePoint image upload failed");
}

export async function uploadDashboardTaskPartImage(
  itemId: number,
  file: File,
): Promise<SharePointAttachment> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Select an image file");
  }

  const result = await client.executeAsync<
    { tableName: string; itemId: number; displayName: string; body: string },
    SharePointAttachment
  >({
    connectorOperation: {
      tableName: DATA_SOURCE_NAME,
      operationName: "CreateAttachment",
      parameters: {
        tableName: dataSourcesInfo[DATA_SOURCE_NAME].tableId,
        itemId,
        displayName: attachmentName(file),
        body: await fileAsBase64(file),
      },
    },
  });

  if (!result.success) throw operationError(result.error);
  return result.data ?? {};
}
