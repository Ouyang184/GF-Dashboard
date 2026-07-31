import type {
  Coils_CollarsBuyoffStructureRead,
  Coils_CollarsBuyoffStructureWrite,
} from "../models/Coils_CollarsBuyoffStructureModel";
import type { IGetAllOptions, IGetOptions } from "../models/CommonModels";
import type { IOperationResult } from "@microsoft/power-apps/data";
import { dataSourcesInfo } from "../../../.power/schemas/appschemas/dataSourcesInfo";
import { getClient } from "@microsoft/power-apps/data";

export class ExtrusionService {
  private static readonly dataSourceName = "extrusion buyoff structure";
  private static readonly client = getClient(dataSourcesInfo);

  public static async create(
    record: Omit<Coils_CollarsBuyoffStructureWrite, "ID">,
  ): Promise<IOperationResult<Coils_CollarsBuyoffStructureRead>> {
    return ExtrusionService.client.createRecordAsync<
      Omit<Coils_CollarsBuyoffStructureWrite, "ID">,
      Coils_CollarsBuyoffStructureRead
    >(ExtrusionService.dataSourceName, record);
  }

  public static async update(
    id: string,
    changedFields: Partial<Omit<Coils_CollarsBuyoffStructureWrite, "ID">>,
  ): Promise<IOperationResult<Coils_CollarsBuyoffStructureRead>> {
    return ExtrusionService.client.updateRecordAsync<
      Partial<Omit<Coils_CollarsBuyoffStructureWrite, "ID">>,
      Coils_CollarsBuyoffStructureRead
    >(ExtrusionService.dataSourceName, id, changedFields);
  }

  public static async delete(id: string): Promise<void> {
    await ExtrusionService.client.deleteRecordAsync(ExtrusionService.dataSourceName, id);
  }

  public static async get(
    id: string,
    options?: IGetOptions,
  ): Promise<IOperationResult<Coils_CollarsBuyoffStructureRead>> {
    return ExtrusionService.client.retrieveRecordAsync<Coils_CollarsBuyoffStructureRead>(
      ExtrusionService.dataSourceName,
      id,
      options,
    );
  }

  public static async getAll(
    options?: IGetAllOptions,
  ): Promise<IOperationResult<Coils_CollarsBuyoffStructureRead[]>> {
    return ExtrusionService.client.retrieveMultipleRecordsAsync<Coils_CollarsBuyoffStructureRead>(
      ExtrusionService.dataSourceName,
      options,
    );
  }
}
