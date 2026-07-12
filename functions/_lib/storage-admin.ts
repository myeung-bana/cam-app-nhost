import { env } from "./env";

function getStorageBaseUrl(): string {
  const subdomain = process.env.NHOST_SUBDOMAIN;
  const region = process.env.NHOST_REGION;
  if (!subdomain || !region) {
    throw new Error("NHOST_SUBDOMAIN and NHOST_REGION are required for storage");
  }
  return `https://${subdomain}.storage.${region}.nhost.run/v1`;
}

function getStorageBucket(): string {
  return process.env.NHOST_STORAGE_BUCKET ?? "cam-bucket";
}

export async function downloadStorageFile(fileId: string): Promise<Buffer> {
  const response = await fetch(`${getStorageBaseUrl()}/files/${fileId}`, {
    headers: {
      "x-hasura-admin-secret": env.adminSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`Storage download failed (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function uploadStorageFile(
  fileName: string,
  bytes: Buffer,
  mimeType: string
): Promise<{ id: string; name: string }> {
  const boundary = `----MemoBakeBoundary${Date.now()}`;
  const bucket = getStorageBucket();
  const safeName = fileName.replace(/[/\\]/g, "_");

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="bucket-id"\r\n\r\n` +
      `${bucket}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file[]"; filename="${safeName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([preamble, bytes, epilogue]);

  const response = await fetch(`${getStorageBaseUrl()}/files`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
      "x-hasura-admin-secret": env.adminSecret,
    },
    body,
  });

  const json = (await response.json()) as {
    processedFiles?: Array<{ id: string; name: string }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(json.error?.message ?? `Storage upload failed (${response.status})`);
  }

  const uploaded = json.processedFiles?.[0];
  if (!uploaded?.id) {
    throw new Error("Storage upload returned no file id");
  }

  return uploaded;
}

export function buildStorageFileUrl(fileId: string): string {
  return `${getStorageBaseUrl()}/files/${fileId}`;
}
