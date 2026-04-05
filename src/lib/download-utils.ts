export interface DownloadProgress {
  received: number;
  total: number;
  bps: number;
  pct: number;
}

export type ProgressCallback = (p: DownloadProgress) => void;

function calcProgress(
  received: number,
  total: number,
  startTime: number
): DownloadProgress {
  const elapsed = (Date.now() - startTime) / 1000;
  const bps = elapsed > 0 ? received / elapsed : 0;
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  return { received, total, bps, pct };
}

export async function streamToDisk(
  res: Response,
  suggestedName: string,
  totalBytes: number,
  onProgress: ProgressCallback
): Promise<void> {
  const handle = await (window as any).showSaveFilePicker({ suggestedName });
  const writable = await handle.createWritable();
  const reader = res.body!.getReader();
  const startTime = Date.now();
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      received += value.byteLength;
      onProgress(calcProgress(received, totalBytes, startTime));
    }
  } finally {
    await writable.close();
  }
}

export async function downloadViaBlob(
  res: Response,
  suggestedName: string,
  mimeType: string,
  totalBytes: number,
  onProgress: ProgressCallback
): Promise<void> {
  const reader = res.body!.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const startTime = Date.now();
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(calcProgress(received, totalBytes, startTime));
  }

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
