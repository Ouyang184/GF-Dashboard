import type { Mastercard } from "./types";

declare global {
  interface Window {
    mastercardDesktop?: {
      search(partNumber: string): Promise<Mastercard[]>;
      chat(message: string, onToken?: (content: string) => void): Promise<{
        content: string;
        matches: Mastercard[];
        model: string;
        logAction?: {
          id: string;
          destination: string;
          records: Mastercard[];
        };
        printAction?: {
          id: string;
          printer: string;
          records: Mastercard[];
        };
      }>;
      confirmOnFloorLog(actionId: string): Promise<{
        success: boolean;
        message: string;
        added: number;
        skipped: number;
      }>;
      confirmPrint(actionId: string): Promise<{
        success: boolean;
        message: string;
        printed: number;
        failed: number;
      }>;
    };
  }
}

export {};
