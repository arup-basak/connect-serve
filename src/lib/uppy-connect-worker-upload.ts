import Uppy, { BasePlugin } from "@uppy/core";
import type { PluginOpts } from "@uppy/core";
import type { Meta, UppyFile } from "@uppy/utils";
import { filterFilesToEmitUploadStarted, filterFilesToUpload } from "@uppy/utils";
import { CHUNK_SIZE } from "./transfer-utils";

export type ConnectWorkerOptions = {
  workerUrl: string;
  ttl: number;
  password: string;
};

type ConnectOpts = PluginOpts & {
  getConnectOptions: () => ConnectWorkerOptions;
};

type ConnectBody = Record<string, unknown>;

export default class ConnectWorkerUpload extends BasePlugin<ConnectOpts, Meta, ConnectBody> {
  constructor(uppy: Uppy<Meta, ConnectBody>, opts: ConnectOpts) {
    super(uppy, opts);
    this.type = "uploader";
    this.id = "ConnectWorkerUpload";
  }

  #handleUpload = async (fileIDs: string[]) => {
    if (fileIDs.length === 0) return;

    const files = this.uppy.getFilesByIds(fileIDs);
    const filesFiltered = filterFilesToUpload(files);
    const filesToEmit = filterFilesToEmitUploadStarted(filesFiltered);
    this.uppy.emit("upload-start", filesToEmit);

    const file = filesFiltered[0];
    if (!file) return;

    const { workerUrl, ttl, password } = this.opts.getConnectOptions();
    const data = file.data as File;

    const ac = new AbortController();
    const onCancelAll = () => ac.abort();
    this.uppy.once("cancel-all", onCancelAll);

    try {
      let sessionId: string;
      let expiresAt: string;
      try {
        const res = await fetch(workerUrl + "/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: data.name,
            fileSize: data.size,
            mimeType: data.type || "application/octet-stream",
            checksum: "",
            ttl,
            ...(password ? { password } : {}),
          }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || `Failed to create session (${res.status})`
          );
        }
        const json = (await res.json()) as { sessionId: string; expiresAt: string };
        sessionId = json.sessionId;
        expiresAt = json.expiresAt;
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.uppy.emit("upload-error", file, err);
        throw err;
      }

      let offset = 0;
      let partNumber = 1;
      let uploadedBytes = 0;
      const startTime = Date.now();

      while (offset < data.size) {
        if (ac.signal.aborted) return;

        const slice = data.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        try {
          const res = await fetch(
            `${workerUrl}/upload-part?session=${encodeURIComponent(sessionId)}&part=${partNumber}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: buffer,
              signal: ac.signal,
            }
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(
              (err as { error?: string }).error || `Part ${partNumber} failed (${res.status})`
            );
          }
        } catch (e: unknown) {
          if (ac.signal.aborted) return;
          const err = e instanceof Error ? e : new Error(String(e));
          const wrapped = new Error(err.message + " — try again.");
          this.uppy.emit("upload-error", file, wrapped);
          throw wrapped;
        }

        uploadedBytes += buffer.byteLength;
        offset += buffer.byteLength;

        const uppyFile = this.uppy.getFile(file.id) as UppyFile<Meta, ConnectBody> | undefined;
        if (uppyFile) {
          this.uppy.emit("upload-progress", uppyFile, {
            uploadStarted: uppyFile.progress.uploadStarted ?? startTime,
            bytesUploaded: uploadedBytes,
            bytesTotal: data.size,
          });
        }

        partNumber++;
      }

      if (ac.signal.aborted) return;

      (this.uppy as { emit: (name: string) => void }).emit("connect-finalising");

      try {
        const res = await fetch(workerUrl + "/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || `Complete failed (${res.status})`
          );
        }
        const body = (await res.json()) as { shareLink: string };
        const uppyFileDone = this.uppy.getFile(file.id);
        if (uppyFileDone) {
          this.uppy.emit("upload-success", uppyFileDone, {
            status: res.status,
            body: { shareLink: body.shareLink, expiresAt },
          });
        }
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.uppy.emit("upload-error", file, err);
        throw err;
      }
    } finally {
      this.uppy.off("cancel-all", onCancelAll);
    }
  };

  install() {
    this.uppy.addUploader(this.#handleUpload);
  }

  uninstall() {
    this.uppy.removeUploader(this.#handleUpload);
  }
}
