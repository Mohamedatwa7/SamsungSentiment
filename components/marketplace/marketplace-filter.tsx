"use client"

import { useState } from "react"
import { Check, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { type Marketplace } from "@/lib/marketplace-data"

const MARKETPLACES: { id: Marketplace; label: string; color: string }[] = [
  { id: "amazon", label: "Amazon", color: "bg-orange-500" },
  { id: "noon", label: "Noon", color: "bg-yellow-500" },
]

interface MarketplaceFilterProps {
  selectedMarketplaces: Marketplace[]
  onMarketplacesChange: (marketplaces: Marketplace[]) => void
}

export function MarketplaceFilter({ 
  selectedMarketplaces, 
  onMarketplacesChange 
}: MarketplaceFilterProps) {
  const allSelected = selectedMarketplaces.length === MARKETPLACES.length
  const noneSelected = selectedMarketplaces.length === 0
  
  const toggleMarketplace = (marketplace: Marketplace) => {
    if (selectedMarketplaces.includes(marketplace)) {
      const newSelection = selectedMarketplaces.filter(m => m !== marketplace)
      onMarketplacesChange(newSelection.length > 0 ? newSelection : MARKETPLACES.map(m => m.id))
    } else {
      onMarketplacesChange([...selectedMarketplaces, marketplace])
    }
  }
  
  const selectAll = () => {
    onMarketplacesChange(MARKETPLACES.map(m => m.id))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-sm border-border bg-transparent shadow-none transition-colors hover:bg-muted/40">
          <Store className="h-4 w-4" />
          <span className="hidden sm:inline">
            {allSelected || noneSelected 
              ? "All Marketplaces" 
              : `${selectedMarketplaces.length} Marketplace${selectedMarketplaces.length > 1 ? "s" : ""}`
            }
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-sm border-border shadow-none">
        <DropdownMenuLabel className="section-label">Filter by Marketplace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={selectAll}
        >
          All Marketplaces
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {MARKETPLACES.map((marketplace) => (
          <DropdownMenuCheckboxItem
            key={marketplace.id}
            checked={selectedMarketplaces.includes(marketplace.id)}
            onCheckedChange={() => toggleMarketplace(marketplace.id)}
          >
            <div className="flex items-center gap-2">
              <div className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-background", marketplace.color)} />
              {marketplace.label}
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function useMarketplaceFilter() {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<Marketplace[]>(["amazon", "noon"])
  
  return {
    selectedMarketplaces,
    setSelectedMarketplaces,
  }
}
