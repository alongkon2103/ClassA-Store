const baseUrl = process.env.NEXT_PUBLIC_BASE_URL_IMG || ""

export function getImageUrl(url: string) {
  if (!url) return ""

  if (url.startsWith("http")) return url

  if (!baseUrl) return url

  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`
}