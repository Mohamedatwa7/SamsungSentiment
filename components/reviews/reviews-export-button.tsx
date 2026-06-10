"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportReviewsToExcel } from "@/lib/export-excel"
import type { AnalyzedReview } from "@/lib/reviews-data"

interface ReviewsExportButtonProps {
  reviews: AnalyzedReview[]
  selectedProducts?: string[]
  variant?: "default" | "outline" | "ghost"
}

export function ReviewsExportButton({ reviews, selectedProducts, variant = "outline" }: ReviewsExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportType, setExportType] = useState<string | null>(null)

  const handleExport = async (type: "full" | "summary" | "products" | "trends") => {
    setIsExporting(true)
    setExportType(type)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      exportReviewsToExcel(reviews, selectedProducts, type)
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
      setExportType(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" disabled={isExporting} className="gap-2">
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export to Excel
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleExport("full")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "full" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Full Report (All Data)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("summary")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "summary" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Summary Only
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("products")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "products" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Product Breakdown
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("trends")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "trends" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Monthly Trends
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
