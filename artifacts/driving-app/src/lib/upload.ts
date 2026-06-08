const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Two-step presigned upload: request an upload URL from the API, then PUT the
 * file directly to object storage. Returns the stored object path.
 */
export async function uploadFileToBucket(file: File): Promise<{ objectPath: string }> {
  const urlRes = await fetch(`${BASE_URL}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Failed to upload file");
  return { objectPath };
}

/** Build a viewable URL for a stored object path (e.g. a headshot or licence photo). */
export function storageUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  return `${BASE_URL}/api/storage${objectPath}`;
}
