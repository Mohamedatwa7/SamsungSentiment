"use client"

import { useState } from "react"

interface TranslatableComment {
  id: string
  text: string
}

// Translation (Arabic/other → English) with a per-comment cache so nothing
// is translated twice. Shared by the F8 launch analysis and the FF8 roster.
export function useCommentTranslations() {
  const [showTranslations, setShowTranslations] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())

  const ensureTranslations = async (comments: TranslatableComment[]) => {
    const pending = comments.filter((c) => !translations.has(c.id) && (c.text || "").trim().length > 0)
    if (pending.length === 0) return
    setTranslating(true)
    const results = new Map(translations)
    const CONCURRENCY = 8
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (c) => {
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: c.text }),
            })
            const out = await res.json()
            if (out?.translatedText) results.set(c.id, out.translatedText)
          } catch {
            // leave the original text; retried next time the toggle is used
          }
        }),
      )
      // Progressive: comments appear translated as batches complete.
      setTranslations(new Map(results))
    }
    setTranslating(false)
  }

  const displayText = (c: TranslatableComment) =>
    showTranslations ? translations.get(c.id) || c.text || "" : c.text || ""

  return { showTranslations, setShowTranslations, translating, translations, ensureTranslations, displayText }
}
