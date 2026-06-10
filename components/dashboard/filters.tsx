"use client"

import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"
import { DateRange } from "react-day-picker"

export function DashboardFilters() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2024, 0, 1),
    to: new Date(),
  })

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "h-9 justify-start text-left font-normal bg-card border-border/50",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      <Select defaultValue="phones">
        <SelectTrigger className="h-9 w-[180px] bg-card border-border/50">
          <SelectValue placeholder="Product Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="phones">Phones</SelectItem>
          <SelectItem value="galaxy-s26">Galaxy S26</SelectItem>
          <SelectItem value="galaxy-z-fold">Galaxy Z Fold</SelectItem>
          <SelectItem value="galaxy-z-flip">Galaxy Z Flip</SelectItem>
          <SelectItem value="galaxy-a-series">Galaxy A Series</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all-gcc">
        <SelectTrigger className="h-9 w-[180px] bg-card border-border/50">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-gcc">All GCC</SelectItem>
          <SelectItem value="uae">UAE</SelectItem>
          <SelectItem value="kuwait">Kuwait</SelectItem>
          <SelectItem value="qatar">Qatar</SelectItem>
          <SelectItem value="bahrain">Bahrain</SelectItem>
          <SelectItem value="oman">Oman</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
