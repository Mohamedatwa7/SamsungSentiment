"use client"

import { useState, useMemo } from "react"
import { 
  getAnalyzedReviews, 
  calculateSentimentMetrics,
  analyzeThemes,
  getProductLines,
  getRatingDistribution,
  getS26FeatureMetrics,
} from "@/lib/reviews-data"
import { ReviewsOverview } from "@/components/reviews/reviews-overview"
import { SentimentCharts } from "@/components/reviews/sentiment-charts"
import { ProductComparison } from "@/components/reviews/product-comparison"
import { ThemeAnalysis } from "@/components/reviews/theme-analysis"
import { ReviewsFeed } from "@/components/reviews/reviews-feed"
import { TrendCharts } from "@/components/reviews/trend-charts"
import { RatingDistribution } from "@/components/reviews/rating-distribution"
import { MonthVsLastYear } from "@/components/reviews/month-vs-lastyear"
import { RefinedKeywordAnalysis } from "@/components/reviews/refined-keyword-analysis"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Filter, X } from "lucide-react"
import { ReviewsExportButton } from "@/components/reviews/reviews-export-button"
import { DateFilter, useDateFilter } from "@/components/dashboard/date-filter"

export default function ReviewsPage() {
  const allReviews = useMemo(() => getAnalyzedReviews(), [])
  const productLines = useMemo(() => getProductLines(allReviews), [allReviews])
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["S26 Ultra", "S26+", "S26"])
  const { dateRange, setDays, setCustomRange, clearDateRange } = useDateFilter(30) // Default to last 30 days
  
  // Date filtered reviews (before product filter, used for comparisons and trends)
  const dateFilteredReviews = useMemo(() => {
    let reviews = allReviews
    
    // Apply date filter using parsedDate (Date object)
    if (dateRange) {
      reviews = reviews.filter(r => r.parsedDate >= dateRange.from && r.parsedDate <= dateRange.to)
    }
    
    return reviews
  }, [allReviews, dateRange])
  
  const filteredReviews = useMemo(() => {
    let reviews = allReviews
    
    // Apply date filter using parsedDate (Date object)
    if (dateRange) {
      reviews = reviews.filter(r => r.parsedDate >= dateRange.from && r.parsedDate <= dateRange.to)
    }
    
    // Apply product filter
    if (selectedProducts.length > 0) {
      reviews = reviews.filter(r => selectedProducts.includes(r.productLine))
    }
    
    return reviews
  }, [allReviews, selectedProducts, dateRange])
  
  const toggleProduct = (product: string) => {
    setSelectedProducts(prev => 
      prev.includes(product) 
        ? prev.filter(p => p !== product)
        : [...prev, product]
    )
  }
  
  const clearFilters = () => setSelectedProducts([])
  const selectAll = () => setSelectedProducts([...productLines])
  
  const metrics = useMemo(() => calculateSentimentMetrics(filteredReviews), [filteredReviews])
  const themes = useMemo(() => analyzeThemes(filteredReviews), [filteredReviews])
  const ratingDist = useMemo(() => getRatingDistribution(filteredReviews), [filteredReviews])
  const featureMetrics = useMemo(() => getS26FeatureMetrics(filteredReviews), [filteredReviews])
  
  // S26 vs S25 comparison (not affected by date filter - uses all reviews for YoY comparison)
  const productComparison = useMemo(() => {
    const s26Reviews = allReviews.filter(r => r.productLine.includes("S26"))
    const s25Reviews = allReviews.filter(r => r.productLine.includes("S25"))
    const s26Metrics = calculateSentimentMetrics(s26Reviews)
    const s25Metrics = calculateSentimentMetrics(s25Reviews)
    return { s26: s26Metrics, s25: s25Metrics }
  }, [allReviews])
  
  
  
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="space-y-1">
          <p className="section-label">Samsung.com · Product Reviews</p>
          <h1 className="display-title text-3xl md:text-4xl">Product Reviews Analysis</h1>
          <p className="text-muted-foreground">
            Sentiment analysis of Samsung.com product reviews
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Filter */}
          <DateFilter dateRange={dateRange} onDateChange={setDays} onCustomRangeChange={setCustomRange} onClear={clearDateRange} />
          
          {/* Product Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="lg"
                className="min-w-[280px] justify-between gap-2 px-4 py-3 text-base font-medium"
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  <span>
                    {selectedProducts.length === 0 
                      ? "All Products" 
                      : `${selectedProducts.length} Product${selectedProducts.length > 1 ? "s" : ""} Selected`}
                  </span>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <div className="border-b p-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Filter by Product</h4>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto nice-scroll p-2">
                {productLines.map(line => (
                  <label
                    key={line}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
                  >
                    <Checkbox 
                      checked={selectedProducts.includes(line)}
                      onCheckedChange={() => toggleProduct(line)}
                    />
                    <span className="text-sm">{line}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Export Button */}
          <ReviewsExportButton 
            reviews={filteredReviews} 
            selectedProducts={selectedProducts}
          />
        </div>
      </div>
      
      {/* Selected Products Badges */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          {selectedProducts.map(product => (
            <Badge key={product} variant="secondary" className="gap-1.5 py-1">
              {product}
              <button onClick={() => toggleProduct(product)} className="hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground">
            Clear all
          </Button>
        </div>
      )}
      
      {/* Overview Cards */}
      <ReviewsOverview metrics={metrics} featureMetrics={featureMetrics} />
      
      {/* Main Content Tabs */}
      <Tabs defaultValue="sentiment" className="w-full">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="comparison">YoY</TabsTrigger>
          <TabsTrigger value="mom-vs-ly">MoM vs LY</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sentiment" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SentimentCharts metrics={metrics} />
            <RatingDistribution distribution={ratingDist} />
          </div>
        </TabsContent>
        
        <TabsContent value="comparison" className="mt-6">
          <ProductComparison 
            s26Metrics={productComparison.s26} 
            s25Metrics={productComparison.s25}
            allReviews={allReviews}
          />
        </TabsContent>
        
        <TabsContent value="mom-vs-ly" className="mt-6">
          <MonthVsLastYear allReviews={allReviews} />
        </TabsContent>
        
        <TabsContent value="trends" className="mt-6">
          <TrendCharts allReviews={allReviews} />
        </TabsContent>
        
        <TabsContent value="keywords" className="mt-6">
          <RefinedKeywordAnalysis reviews={filteredReviews} />
        </TabsContent>
        
        <TabsContent value="themes" className="mt-6">
          <ThemeAnalysis themes={themes} reviews={filteredReviews} />
        </TabsContent>
        
        <TabsContent value="reviews" className="mt-6">
          <ReviewsFeed reviews={filteredReviews} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
