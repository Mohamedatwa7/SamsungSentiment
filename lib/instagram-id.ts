// Instagram media IDs and shortcodes are two encodings of the same number:
// the shortcode is the media ID written in base-64 with Instagram's alphabet.
// Converting between them lets us join posts keyed by numeric ID with
// comments keyed by shortcode (and vice versa) without any lookup table.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

export function instagramIdToShortcode(id: string): string | null {
  if (!/^\d+$/.test(id)) return null
  try {
    let n = BigInt(id)
    let s = ""
    while (n > 0n) {
      s = ALPHABET[Number(n % 64n)] + s
      n /= 64n
    }
    return s || null
  } catch {
    return null
  }
}

export function instagramShortcodeToId(shortcode: string): string | null {
  if (!/^[A-Za-z0-9\-_]{5,15}$/.test(shortcode)) return null
  try {
    let n = 0n
    for (const c of shortcode) {
      const i = ALPHABET.indexOf(c)
      if (i < 0) return null
      n = n * 64n + BigInt(i)
    }
    return n.toString()
  } catch {
    return null
  }
}

// Extract the shortcode from an instagram.com/p/... or /reel/... URL.
export function instagramShortcodeFromUrl(url: string): string | null {
  const m = String(url || "").match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9\-_]+)/)
  return m ? m[1] : null
}
