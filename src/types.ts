export interface Bindings {
  R2: R2Bucket;
  DB: KVNamespace;
  MAX_FILE_SIZE: string;
  WORKER_URL: string;
}

export interface SessionRecord {
  uploadId: string;
  r2Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  expiresAt: number;
  parts: PartRecord[];
  complete: boolean;
}

export interface PartRecord {
  partNumber: number;
  etag: string;
}

export interface CreateSessionBody {
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  // Requested TTL in seconds. Server clamps to ALLOWED_TTLS. Defaults to 3600.
  ttl?: number;
}

export interface CompleteBody {
  sessionId: string;
}
