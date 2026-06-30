import { useCallback, useEffect, useState } from "react";
import { runIntouchOcr, type IntouchSnapshot } from "@/lib/intouch-ocr";

const STORAGE_KEY = "intouch-snapshot-v1";

type StoredSnapshot = {
  imageDataUrl: string;
  snapshot: IntouchSnapshot;
};

function loadStored(): StoredSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSnapshot;
  } catch {
    return null;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function useIntouchSnapshot() {
  const [snapshot, setSnapshot] = useState<IntouchSnapshot | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadStored();
    if (s) {
      setSnapshot(s.snapshot);
      setImageUrl(s.imageDataUrl);
    }
  }, []);

  const ingest = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const snap = await runIntouchOcr(dataUrl);
      setImageUrl(dataUrl);
      setSnapshot(snap);
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ imageDataUrl: dataUrl, snapshot: snap }),
        );
      } catch {
        /* quota exceeded — fine, just don't persist */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read screenshot");
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSnapshot(null);
    setImageUrl(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  return { snapshot, imageUrl, busy, error, ingest, reset };
}