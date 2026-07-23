// FF8 campaign influencer roster (client-safe: no server imports).
// Provided by the marketing team on 2026-07-23 — exact handles from the
// shared profile links. Only their FF8-related videos from the launch window
// are tracked.

export type RosterCategory = "Team Galaxy" | "Content Creator"
export type RosterPlatform = "instagram" | "tiktok"

export interface RosterInfluencer {
  id: string
  name: string
  handle: string
  platform: RosterPlatform
  url: string
  category: RosterCategory
}

export const FF8_ROSTER: RosterInfluencer[] = [
  { id: "amirdeleon", name: "Amir Deleon", handle: "amir.deleon", platform: "instagram", url: "https://www.instagram.com/amir.deleon/", category: "Team Galaxy" },
  { id: "basharkk", name: "Bashar Kayal", handle: "basharkk", platform: "instagram", url: "https://www.instagram.com/basharkk", category: "Team Galaxy" },
  { id: "joycegchamoun", name: "Joyce Chamoun", handle: "joycegchamoun", platform: "tiktok", url: "https://www.tiktok.com/@joycegchamoun", category: "Team Galaxy" },
  { id: "yazxan", name: "Yazan Attal", handle: "yazxan", platform: "instagram", url: "https://www.instagram.com/yazxan/", category: "Team Galaxy" },
  { id: "hazansasou", name: "Hazan Sasou", handle: "hazansasou_", platform: "instagram", url: "https://www.instagram.com/hazansasou_/", category: "Team Galaxy" },
  { id: "alghalyab", name: "Ghalya", handle: "alghalyab", platform: "tiktok", url: "https://www.tiktok.com/@alghalyab", category: "Content Creator" },
  { id: "abdullahhamadah", name: "Abdullah Hamadah", handle: "abdullah_hamadah", platform: "instagram", url: "https://www.instagram.com/abdullah_hamadah/", category: "Team Galaxy" },
  { id: "taraabujrab", name: "Tara Aburjab", handle: "taraabujrab", platform: "instagram", url: "https://www.instagram.com/taraabujrab/", category: "Content Creator" },
  { id: "cedrabeauty", name: "Cedra Amara", handle: "cedrabeauty", platform: "tiktok", url: "https://www.tiktok.com/@cedrabeauty", category: "Content Creator" },
  { id: "ramyhamdan", name: "Ramy Hamdan", handle: "ramyhamdan", platform: "tiktok", url: "https://www.tiktok.com/@ramyhamdan", category: "Content Creator" },
  { id: "omr94", name: "Omar Farooq", handle: "omr94", platform: "instagram", url: "https://www.instagram.com/omr94/", category: "Team Galaxy" },
  { id: "farhaahmd", name: "Farha Ahmad", handle: "farhaahmd", platform: "instagram", url: "https://www.instagram.com/farhaahmd/", category: "Team Galaxy" },
  { id: "971vlog", name: "971vlog", handle: "971vlog", platform: "instagram", url: "https://www.instagram.com/971vlog/", category: "Content Creator" },
  { id: "loutabara", name: "Lou Tabara", handle: "loutabara", platform: "instagram", url: "https://www.instagram.com/loutabara/", category: "Team Galaxy" },
  { id: "aneezv", name: "Mohammed Aneez", handle: "aneezv", platform: "instagram", url: "https://www.instagram.com/aneezv/", category: "Team Galaxy" },
  { id: "danthelion", name: "Danthelion", handle: "danthelion_15", platform: "tiktok", url: "https://www.tiktok.com/@danthelion_15", category: "Team Galaxy" },
  { id: "eighty8", name: "Eighty8", handle: "eighty8.k", platform: "instagram", url: "https://www.instagram.com/eighty8.k/", category: "Team Galaxy" },
  { id: "mustafaa7", name: "Mustafa", handle: "mustafaa7", platform: "instagram", url: "https://www.instagram.com/mustafaa7/", category: "Team Galaxy" },
  { id: "therahal", name: "Melissa & Miled", handle: "the.rahal", platform: "instagram", url: "https://www.instagram.com/the.rahal/", category: "Team Galaxy" },
  { id: "ijaziii", name: "Jazeem", handle: "i_jaziii", platform: "instagram", url: "https://www.instagram.com/i_jaziii", category: "Team Galaxy" },
  { id: "100pixels", name: "Mostafa Eldiasty", handle: "100_pixels", platform: "instagram", url: "https://www.instagram.com/100_pixels", category: "Content Creator" },
  { id: "monihasbini", name: "Moni Hasbini", handle: "monihasbini", platform: "instagram", url: "https://www.instagram.com/monihasbini", category: "Content Creator" },
  { id: "emaratinotraveler", name: "Fahed Al Blooshi", handle: "emaratinotraveler", platform: "instagram", url: "https://www.instagram.com/emaratinotraveler/", category: "Content Creator" },
  { id: "thetwins8", name: "Tariq and Munter", handle: "thetwins8_", platform: "instagram", url: "https://www.instagram.com/thetwins8_/", category: "Content Creator" },
  { id: "dasrami", name: "Rami Sabbah", handle: "das.rami", platform: "instagram", url: "https://www.instagram.com/das.rami/", category: "Content Creator" },
  { id: "amalbinhaider", name: "Amal Bin Haider", handle: "amalbinhaider", platform: "instagram", url: "https://www.instagram.com/amalbinhaider/", category: "Team Galaxy" },
  { id: "zozalajail", name: "Abdulaziz AlAjall", handle: "zozalajail", platform: "tiktok", url: "https://www.tiktok.com/@zozalajail", category: "Team Galaxy" },
]

export function rosterByHandle(handle: string | null | undefined): RosterInfluencer | undefined {
  const h = (handle || "").toLowerCase().trim().replace(/^@/, "")
  return FF8_ROSTER.find((r) => r.handle.toLowerCase() === h)
}
