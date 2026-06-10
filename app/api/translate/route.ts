import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = "en" } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }
    
    // Use Google Translate API (free tier via unofficial endpoint)
    // This is a simple approach - for production, use official Google Cloud Translation API
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    )
    
    if (!response.ok) {
      throw new Error("Translation service unavailable")
    }
    
    const data = await response.json()
    
    // Extract translated text from response
    // Response format: [[["translated text","original text",null,null,10],...],null,"ar",...]
    let translatedText = ""
    if (data && data[0]) {
      translatedText = data[0]
        .filter((item: unknown[]) => item && item[0])
        .map((item: unknown[]) => item[0])
        .join("")
    }
    
    return NextResponse.json({ 
      translatedText: translatedText || text,
      detectedLanguage: data[2] || "unknown"
    })
  } catch (error) {
    console.error("Translation error:", error)
    return NextResponse.json(
      { error: "Translation failed", translatedText: null },
      { status: 500 }
    )
  }
}
