import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { REMOTE, UPLOAD_DIR, blobStore } from "./db";

export const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export const VALID_NAME = /^[\w-]+\.(png|jpe?g|gif|webp)$/i;

function localPath(name: string) {
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, path.basename(name));
}

export async function saveUpload(name: string, data: ArrayBuffer): Promise<void> {
  if (REMOTE) await blobStore("tradelog-uploads").set(name, data);
  else await fs.writeFile(localPath(name), Buffer.from(data));
}

export async function readUpload(name: string): Promise<ArrayBuffer | null> {
  if (!VALID_NAME.test(name)) return null;
  if (REMOTE) return blobStore("tradelog-uploads").get(name, { type: "arrayBuffer" });
  try {
    const buf = await fs.readFile(localPath(name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

export async function deleteUpload(name: string): Promise<void> {
  if (REMOTE) await blobStore("tradelog-uploads").delete(name);
  else await fs.rm(localPath(name), { force: true });
}
