"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Filter, Check } from "lucide-react"

export type Platform = "instagram" | "tiktok" | "twitter" | "facebook"

export interface PlatformFilterProps {
  selectedPlatforms: Platform[]
  onPlatformsChange: (platforms: Platform[]) => void
}

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "instagram", label: "Instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500" },
  { id: "tiktok", label: "TikTok", color: "bg-black dark:bg-white" },
  { id: "twitter", label: "X (Twitter)", color: "bg-black dark:bg-white" },
  { id: "facebook", label: "Facebook", color: "bg-blue-600" },
]

export function PlatformFilter({ selectedPlatforms, onPlatformsChange }: PlatformFilterProps) {
  const allSelected = selectedPlatforms.length === PLATFORMS.length
  const noneSelected = selectedPlatforms.length === 0

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      onPlatformsChange(selectedPlatforms.filter(p => p !== platform))
    } else {
      onPlatformsChange([...selectedPlatforms, platform])
    }
  }

  const selectAll = () => {
    onPlatformsChange(PLATFORMS.map(p => p.id))
  }

  const clearAll = () => {
    onPlatformsChange([])
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            <span>Platforms</span>
            {!allSelected && selectedPlatforms.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {selectedPlatforms.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Data Sources</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PLATFORMS.map((platform) => (
            <DropdownMenuCheckboxItem
              key={platform.id}
              checked={selectedPlatforms.includes(platform.id)}
              onCheckedChange={() => togglePlatform(platform.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${platform.color}`} />
                {platform.label}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <div className="flex items-center justify-between px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={selectAll}
              disabled={allSelected}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={clearAll}
              disabled={noneSelected}
            >
              Clear
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active platform badges */}
      <div className="flex flex-wrap gap-1">
        {selectedPlatforms.length === 0 ? (
          <span className="text-xs text-muted-foreground">No platforms selected</span>
        ) : selectedPlatforms.length === PLATFORMS.length ? (
          <Badge variant="outline" className="text-xs">All Platforms</Badge>
        ) : (
          selectedPlatforms.map(platformId => {
            const platform = PLATFORMS.find(p => p.id === platformId)
            return platform ? (
              <Badge 
                key={platform.id} 
                variant="secondary" 
                className="text-xs gap-1 cursor-pointer hover:bg-destructive/10"
                onClick={() => togglePlatform(platform.id)}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${platform.color}`} />
                {platform.label}
                <span className="ml-0.5 text-muted-foreground hover:text-destructive">×</span>
              </Badge>
            ) : null
          })
        )}
      </div>
    </div>
  )
}

// Hook for managing platform filter state
export function usePlatformFilter(initialPlatforms?: Platform[]) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    initialPlatforms ?? ["instagram", "tiktok", "twitter", "facebook"]
  )

  return {
    selectedPlatforms,
    setSelectedPlatforms,
    isSelected: (platform: Platform) => selectedPlatforms.includes(platform),
    allSelected: selectedPlatforms.length === 4,
    noneSelected: selectedPlatforms.length === 0,
  }
}
