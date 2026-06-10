"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, Filter, X, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  getSegmentationTree,
  type Segmentation,
  type SegmentationTree,
} from "@/lib/comments-data"

interface SegmentationFilterProps {
  value: Segmentation
  onChange: (next: Segmentation) => void
}

// Department display labels
const DEPT_LABELS: Record<string, string> = {
  MX: "MX — Mobile Experience",
  VD: "VD — Visual Display",
  DA: "DA — Digital Appliances",
  Brand: "Brand & Other",
}

export function SegmentationFilter({ value, onChange }: SegmentationFilterProps) {
  const tree: SegmentationTree[] = useMemo(() => getSegmentationTree(), [])
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>(() => {
    // Auto-expand departments that have selections
    const init: Record<string, boolean> = {}
    if (value.departments?.length) for (const d of value.departments) init[d] = true
    return init
  })
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})

  const totalSelections =
    (value.departments?.length || 0) +
    (value.productCategories?.length || 0) +
    (value.productModels?.length || 0)

  const toggleDept = (dept: string) => {
    const set = new Set(value.departments || [])
    set.has(dept) ? set.delete(dept) : set.add(dept)
    onChange({ ...value, departments: [...set] })
  }
  const toggleCategory = (cat: string) => {
    const set = new Set(value.productCategories || [])
    set.has(cat) ? set.delete(cat) : set.add(cat)
    onChange({ ...value, productCategories: [...set] })
  }
  const toggleModel = (model: string) => {
    const set = new Set(value.productModels || [])
    set.has(model) ? set.delete(model) : set.add(model)
    onChange({ ...value, productModels: [...set] })
  }
  const clearAll = () => onChange({})

  // Helper: pick a label for the trigger button
  const triggerLabel = useMemo(() => {
    if (totalSelections === 0) return "All Departments"
    const parts: string[] = []
    if (value.departments?.length) parts.push(`${value.departments.length} dept`)
    if (value.productCategories?.length) parts.push(`${value.productCategories.length} cat`)
    if (value.productModels?.length) parts.push(`${value.productModels.length} model`)
    return parts.join(" · ")
  }, [value, totalSelections])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-w-[220px] justify-between gap-2",
            totalSelections > 0 && "border-primary/60 ring-1 ring-primary/20",
          )}
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-sm">{triggerLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="border-b p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Segmentation</h4>
            </div>
            {totalSelections > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
                Clear all
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Drill down by department, then category and model
          </p>
        </div>

        <ScrollArea className="max-h-[420px]">
          <div className="p-2">
            {tree.map((dept) => {
              const isExpanded = expandedDepts[dept.department]
              const isSelected = value.departments?.includes(dept.department)
              return (
                <div key={dept.department} className="mb-1">
                  {/* Department row */}
                  <div className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDepts((prev) => ({ ...prev, [dept.department]: !prev[dept.department] }))
                      }
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <label className="flex flex-1 cursor-pointer items-center gap-2 py-0.5">
                      <Checkbox
                        checked={!!isSelected}
                        onCheckedChange={() => toggleDept(dept.department)}
                      />
                      <span className="text-sm font-medium">{DEPT_LABELS[dept.department] ?? dept.department}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {dept.commentCount.toLocaleString()}
                      </span>
                    </label>
                  </div>

                  {/* Categories */}
                  {isExpanded && (
                    <div className="ml-4 space-y-1 border-l border-border pl-2">
                      {dept.categories.map((cat) => {
                        const catKey = `${dept.department}::${cat.name}`
                        const catExpanded = expandedCats[catKey]
                        const catSelected = value.productCategories?.includes(cat.name)
                        return (
                          <div key={cat.name}>
                            <div className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted/60">
                              <button
                                type="button"
                                onClick={() => setExpandedCats((prev) => ({ ...prev, [catKey]: !prev[catKey] }))}
                                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                aria-label={catExpanded ? "Collapse" : "Expand"}
                              >
                                {catExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              <label className="flex flex-1 cursor-pointer items-center gap-2 py-0.5">
                                <Checkbox
                                  checked={!!catSelected}
                                  onCheckedChange={() => toggleCategory(cat.name)}
                                />
                                <span className="text-sm">{cat.name}</span>
                                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                                  {cat.commentCount.toLocaleString()}
                                </span>
                              </label>
                            </div>

                            {/* Models */}
                            {catExpanded && (
                              <div className="ml-4 space-y-0.5 border-l border-border/60 pl-2">
                                {cat.models.map((model) => {
                                  const modelSelected = value.productModels?.includes(model.name)
                                  return (
                                    <label
                                      key={model.name}
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/60"
                                    >
                                      <Checkbox
                                        checked={!!modelSelected}
                                        onCheckedChange={() => toggleModel(model.name)}
                                      />
                                      <span className="text-foreground">{model.name}</span>
                                      <span className="ml-auto tabular-nums text-muted-foreground">
                                        {model.commentCount.toLocaleString()}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {totalSelections > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5 p-3">
              {value.departments?.map((d) => (
                <Badge key={`dept-${d}`} variant="secondary" className="gap-1 text-xs">
                  {d}
                  <button onClick={() => toggleDept(d)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {value.productCategories?.map((c) => (
                <Badge key={`cat-${c}`} variant="secondary" className="gap-1 text-xs">
                  {c}
                  <button onClick={() => toggleCategory(c)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {value.productModels?.map((m) => (
                <Badge key={`model-${m}`} variant="default" className="gap-1 text-xs">
                  {m}
                  <button onClick={() => toggleModel(m)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// CONTEXT — lets nested components read segmentation without prop drilling
// =============================================================================

interface SegmentationContextValue {
  segmentation: Segmentation
  setSegmentation: (s: Segmentation) => void
}

const SegmentationContext = createContext<SegmentationContextValue | null>(null)

export function SegmentationProvider({ children, initial = {} }: { children: ReactNode; initial?: Segmentation }) {
  const [segmentation, setSegmentation] = useState<Segmentation>(initial)
  const value = useMemo(() => ({ segmentation, setSegmentation }), [segmentation])
  return <SegmentationContext.Provider value={value}>{children}</SegmentationContext.Provider>
}

export function useSegmentation(): SegmentationContextValue {
  const ctx = useContext(SegmentationContext)
  if (!ctx) {
    // Safe fallback so components used outside the provider still work
    return { segmentation: {}, setSegmentation: () => {} }
  }
  return ctx
}
