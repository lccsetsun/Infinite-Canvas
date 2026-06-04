export function isLocalBrowserAsset(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:");
}

export function isPreviewableAsset(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/") || isLocalBrowserAsset(url);
}

export function extensionFromAssetUrl(url: string, fallback: string) {
  const extensionMatch = url.match(/\.(png|jpe?g|webp|gif|mp4|webm|ogg|mov)(?=($|[?#]))/i);
  return extensionMatch?.[1]?.replace(/^jpeg$/i, "jpg").toLowerCase() || fallback;
}

export async function downloadMediaAsset(url: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;

  if (isLocalBrowserAsset(url)) {
    link.href = url;
  } else {
    link.href = `/api/download-asset?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  }

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
