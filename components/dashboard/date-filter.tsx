"use client"

import { useState, useCallback, useEffect } from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { DateRange as DayPickerDateRange } from "react-day-picker"

export interface DateRange {
  from: Date
  to: Date
  label: string
}

function getDefaultDateRange(days: number = 30): DateRange {
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  
  const from = new Date()
  from.setDate(from.getDate() - days)
  from.setHours(0, 0, 0, 0)
  
  return { from, to, label: `Last ${days} days` }
}

function formatDateRangeLabel(from: Date, to: Date): string {
  const fromStr = format(from, "MMM d, yyyy")
  const toStr = format(to, "MMM d, yyyy")
  
  // Same day
  if (fromStr === toStr) {
    return fromStr
  }
  
  // Same year
  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`
  }
  
  return `${fromStr} - ${toStr}`
}

// Hook for managing date filter state - dateRange can be null (no filter)
// Initialize as null to avoid hydration mismatch, then set on client
export function useDateFilter(initialDays: number = 30) {
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Initialize date range only on client side to avoid hydration mismatch
  useEffect(() => {
    if (!isInitialized) {
      setDateRange(getDefaultDateRange(initialDays))
      setIsInitialized(true)
    }
  }, [initialDays, isInitialized])
  
  const setCustomRange = useCallback((from: Date, to: Date) => {
    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    
    setDateRange({
      from: fromDate,
      to: toDate,
      label: formatDateRangeLabel(fromDate, toDate)
    })
  }, [])
  
  const setDays = useCallback((days: number) => {
    setDateRange(getDefaultDateRange(days))
  }, [])
  
  const clearDateRange = useCallback(() => {
    setDateRange(null)
  }, [])
  
  return { dateRange, setDays, setCustomRange, clearDateRange }
}

// Helper to check if a date string is within range
export function isWithinDateRange(dateString: string, dateRange: DateRange | null): boolean {
  if (!dateRange) return true // No filter = include all
  const date = new Date(dateString)
  return date >= dateRange.from && date <= dateRange.to
}

interface DateFilterProps {
  dateRange: DateRange | null
  onDateChange: (days: number) => void
  onCustomRangeChange?: (from: Date, to: Date) => void
  onClear?: () => void
}

export function DateFilter({ dateRange, onDateChange, onCustomRangeChange, onClear }: DateFilterProps) {
  const [open, setOpen] = useState(false)
  
  // Derive selectedRange from dateRange prop to stay in sync
  const selectedRange: DayPickerDateRange | undefined = dateRange 
    ? { from: dateRange.from, to: dateRange.to }
    : undefined
  
  const handleSelect = (range: DayPickerDateRange | undefined) => {
    if (range?.from && range?.to && onCustomRangeChange) {
      onCustomRangeChange(range.from, range.to)
      setOpen(false)
    } else if (range?.from && !range?.to && onCustomRangeChange) {
      // Single date selected - use same date for from and to
      onCustomRangeChange(range.from, range.from)
      setOpen(false)
    }
  }
  
  const handlePreset = (days: number) => {
    onDateChange(days)
    setOpen(false)
  }
  
  const handleClear = () => {
    if (onClear) {
      onClear()
    }
    setOpen(false)
  }
  
  const displayLabel = dateRange ? dateRange.label : "All time"
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 min-w-[140px] justify-start">
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs sm:text-sm">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          {/* Quick presets sidebar */}
          <div className="border-b sm:border-b-0 sm:border-r p-3 space-y-1 max-h-[400px] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Select</p>
            {[
              { label: "Today", days: 0 },
              { label: "Last 7 days", days: 7 },
              { label: "Last 14 days", days: 14 },
              { label: "Last 30 days", days: 30 },
              { label: "Last 60 days", days: 60 },
              { label: "Last 90 days", days: 90 },
              { label: "Last 180 days", days: 180 },
              { label: "Last 270 days", days: 270 },
              { label: "Last 365 days", days: 365 },
            ].map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7"
                onClick={() => {
                  if (preset.days === 0) {
                    // Today
                    const today = new Date()
                    if (onCustomRangeChange) {
                      onCustomRangeChange(today, today)
                    }
                    setOpen(false)
                  } else {
                    handlePreset(preset.days)
                  }
                }}
              >
                {preset.label}
              </Button>
            ))}
            
            <div className="border-t my-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quarters</p>
              {(() => {
                const currentYear = new Date().getFullYear()
                const quarters = [
                  { label: "Q1", start: new Date(currentYear, 0, 1), end: new Date(currentYear, 2, 31) },
                  { label: "Q2", start: new Date(currentYear, 3, 1), end: new Date(currentYear, 5, 30) },
                  { label: "Q3", start: new Date(currentYear, 6, 1), end: new Date(currentYear, 8, 30) },
                  { label: "Q4", start: new Date(currentYear, 9, 1), end: new Date(currentYear, 11, 31) },
                ]
                return quarters.map((q) => (
                  <Button
                    key={q.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => {
                      if (onCustomRangeChange) {
                        onCustomRangeChange(q.start, q.end > new Date() ? new Date() : q.end)
                      }
                      setOpen(false)
                    }}
                  >
                    {q.label} {currentYear}
                  </Button>
                ))
              })()}
            </div>
          </div>
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={selectedRange}
              onSelect={handleSelect}
              numberOfMonths={1}
              defaultMonth={dateRange?.from ?? new Date()}
              disabled={{ after: new Date() }}
              initialFocus
            />
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-xs text-muted-foreground">
                {selectedRange?.from && selectedRange?.to ? (
                  formatDateRangeLabel(selectedRange.from, selectedRange.to)
                ) : selectedRange?.from ? (
                  format(selectedRange.from, "MMM d, yyyy")
                ) : (
                  "All time (no filter)"
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleClear}
              >
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
