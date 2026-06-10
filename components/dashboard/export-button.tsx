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
import { exportDashboardToExcel } from "@/lib/export-excel"
import type { Platform } from "@/lib/social-data"

interface ExportButtonProps {
  platformFilter?: Platform[]
  variant?: "default" | "outline" | "ghost"
}

export function DashboardExportButton({ platformFilter, variant = "outline" }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportType, setExportType] = useState<string | null>(null)

  const handleExport = async (type: "full" | "kpis" | "sentiment" | "platform" | "comments") => {
    setIsExporting(true)
    setExportType(type)
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100))
      exportDashboardToExcel(platformFilter, type)
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
          onClick={() => handleExport("kpis")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "kpis" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          KPIs Only
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("sentiment")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "sentiment" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Sentiment Analysis
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("platform")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "platform" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Platform Metrics
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport("comments")}
          disabled={isExporting}
          className="cursor-pointer"
        >
          {exportType === "comments" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Comments Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
