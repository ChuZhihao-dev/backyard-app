export type ShopifyMediaNode = {
  mediaContentType: string;
  status: string;
  sources?: Array<{
    format: string;
    mimeType: string;
    url: string;
  }>;
};

export type MetafieldFileReference = {
  url?: string | null;
  sources?: Array<{ url: string; format: string }> | null;
  image?: { url: string } | null;
} | null;

export function findFileReferenceUrl(reference: MetafieldFileReference) {
  if (!reference) return null;
  if (reference.url) return reference.url;

  const sources = reference.sources ?? [];
  const glb = sources.find(
    (source) => source.format?.toLowerCase() === "glb",
  );
  if (glb?.url) return glb.url;
  if (sources[0]?.url) return sources[0].url;

  if (reference.image?.url) return reference.image.url;
  return null;
}

export function findReadyGlbUrl(media: ShopifyMediaNode[]) {
  for (const item of media) {
    if (
      item.mediaContentType !== "MODEL_3D" ||
      item.status !== "READY" ||
      !item.sources
    ) {
      continue;
    }

    const source = item.sources.find(
      ({ format, mimeType }) =>
        format.toLowerCase() === "glb" ||
        mimeType.toLowerCase() === "model/gltf-binary",
    );
    if (source) return source.url;
  }

  return null;
}

export function getModel3dAvailability(media: ShopifyMediaNode[]) {
  if (findReadyGlbUrl(media)) return "ready" as const;
  if (media.some((item) => item.mediaContentType === "MODEL_3D")) {
    return "processing" as const;
  }
  return "missing" as const;
}
