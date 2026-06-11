"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ThumbsUp, ThumbsDown, Minus, Camera, Monitor, Battery, Cpu, Sparkles, Palette, PenTool, Settings, DollarSign, Volume2, Eye, Moon, RotateCcw } from "lucide-react"

import type { ThemeAnalysis as ThemeAnalysisType, AnalyzedReview, S26FeatureMetrics } from "@/lib/reviews-data"
import { getS26FeatureMetrics } from "@/lib/reviews-data"

interface ThemeAnalysisProps {
  themes: ThemeAnalysisType[]
  reviews: AnalyzedReview[]
}

const themeIcons: Record<string, React.ElementType> = {
  "Camera": Camera,
  "Display": Monitor,
  "Battery": Battery,
  "Performance": Cpu,
  "AI Features": Sparkles,
  "Design": Palette,
  "S Pen": PenTool,
  "Software": Settings,
  "Value": DollarSign,
  "Audio": Volume2,
  "General": Minus
}

export function ThemeAnalysis({ themes, reviews }: ThemeAnalysisProps) {
  const totalReviews = reviews.length
  const featureMetrics = getS26FeatureMetrics(reviews)
  
  // S26 Key Features data
  const s26Features = [
    { 
      name: "Privacy Display", 
      mentions: featureMetrics.privacyDisplay.mentions, 
      positiveRate: featureMetrics.privacyDisplay.positiveRate,
      icon: Eye, 
      color: "text-violet-500", 
      bgColor: "bg-violet-500/10",
      description: "Anti-peep screen technology"
    },
    { 
      name: "Nightography", 
      mentions: featureMetrics.nightography.mentions,
      positiveRate: featureMetrics.nightography.positiveRate, 
      icon: Moon, 
      color: "text-indigo-500", 
      bgColor: "bg-indigo-500/10",
      description: "Enhanced low-light photography"
    },
    { 
      name: "Horizontal Lock", 
      mentions: featureMetrics.horizontalLock.mentions,
      positiveRate: featureMetrics.horizontalLock.positiveRate, 
      icon: RotateCcw, 
      color: "text-cyan-500", 
      bgColor: "bg-cyan-500/10",
      description: "Screen rotation control"
    },
  ]
  
  // Get top positive and negative themes
  const topPositiveThemes = [...themes]
    .sort((a, b) => (b.positive / b.count) - (a.positive / a.count))
    .slice(0, 5)
  
  const topNegativeThemes = [...themes]
    .filter(t => t.negative > 0)
    .sort((a, b) => (b.negative / b.count) - (a.negative / a.count))
    .slice(0, 5)
  
  return (
    <div className="grid gap-6">
      {/* S26 Key Features Section */}
      <Card>
        <CardHeader>
          <CardTitle>S26 Key Features Mentions</CardTitle>
          <CardDescription>Tracking mentions of the three flagship features in reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="stat-rail grid gap-y-8 sm:grid-cols-3">
            {s26Features.map((feature) => {
              const Icon = feature.icon
              const percentOfReviews = totalReviews > 0 ? ((feature.mentions / totalReviews) * 100).toFixed(1) : 0

              return (
                <div key={feature.name} className="flex flex-col gap-1 px-5 first:pl-0">
                  <p className="font-semibold flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {feature.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="kpi-value text-3xl">{feature.mentions}</span>
                    <span className="text-xs text-muted-foreground">mentions</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{feature.positiveRate}% positive</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden bg-muted">
                      <div
                        className="h-full bg-positive transition-all duration-500 ease-out"
                        style={{ width: `${feature.positiveRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Theme Overview Cards */}
      <div className="rule-t stat-rail grid gap-y-8 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {themes.slice(0, 5).map((theme) => {
          const Icon = themeIcons[theme.theme] || Minus
          const positivePercent = Math.round((theme.positive / theme.count) * 100)

          return (
            <div key={theme.theme} className="flex flex-col gap-1 px-5 first:pl-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{theme.theme}</p>
                    <p className="text-xs text-muted-foreground">{theme.count} mentions</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    theme.sentiment === "positive" ? "bg-transparent border-positive/40 text-positive" :
                    theme.sentiment === "negative" ? "bg-transparent border-negative/40 text-negative" :
                    "bg-transparent border-border text-muted-foreground"
                  }
                >
                  {positivePercent}%
                </Badge>
              </div>
              <div className="mt-3">
                <div className="flex gap-px h-1.5">
                  <div
                    className="bg-positive transition-all duration-500 ease-out"
                    style={{ width: `${(theme.positive / theme.count) * 100}%` }}
                  />
                  <div
                    className="bg-muted-foreground/50 transition-all duration-500 ease-out"
                    style={{ width: `${(theme.neutral / theme.count) * 100}%` }}
                  />
                  <div
                    className="bg-negative transition-all duration-500 ease-out"
                    style={{ width: `${(theme.negative / theme.count) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Top Themes Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Positive Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              Most Praised Aspects
            </CardTitle>
            <CardDescription>Themes with highest positive sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPositiveThemes.map((theme, index) => {
                const Icon = themeIcons[theme.theme] || Minus
                const positivePercent = Math.round((theme.positive / theme.count) * 100)
                
                return (
                  <div key={theme.theme} className="flex items-center gap-4">
                    <div className="kpi-value w-6 text-right text-lg text-muted-foreground tabular-nums">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{theme.theme}</span>
                        </div>
                        <span className="text-sm text-positive font-medium tabular-nums">{positivePercent}% positive</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-positive transition-all duration-500 ease-out"
                          style={{ width: `${positivePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* Most Criticized Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-muted-foreground" />
              Areas for Improvement
            </CardTitle>
            <CardDescription>Themes with notable negative sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topNegativeThemes.length > 0 ? topNegativeThemes.map((theme, index) => {
                const Icon = themeIcons[theme.theme] || Minus
                const negativePercent = Math.round((theme.negative / theme.count) * 100)
                
                return (
                  <div key={theme.theme} className="flex items-center gap-4">
                    <div className="kpi-value w-6 text-right text-lg text-muted-foreground tabular-nums">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{theme.theme}</span>
                        </div>
                        <span className="text-sm text-negative font-medium tabular-nums">{negativePercent}% negative</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-negative transition-all duration-500 ease-out"
                          style={{ width: `${negativePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-muted-foreground text-sm">No significant negative themes found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* All Themes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Theme Analysis</CardTitle>
          <CardDescription>All detected themes with detailed sentiment breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto nice-scroll">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b">
                  <th className="section-label pb-3 text-left">Theme</th>
                  <th className="section-label pb-3 text-center">Mentions</th>
                  <th className="section-label pb-3 text-center">% of Reviews</th>
                  <th className="section-label pb-3 text-center">Positive</th>
                  <th className="section-label pb-3 text-center">Neutral</th>
                  <th className="section-label pb-3 text-center">Negative</th>
                  <th className="section-label pb-3 text-center">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {themes.map((theme) => {
                  const Icon = themeIcons[theme.theme] || Minus
                  const percentOfReviews = totalReviews > 0 ? Math.round((theme.count / totalReviews) * 100) : 0
                  
                  return (
                    <tr key={theme.theme} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{theme.theme}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center">{theme.count.toLocaleString()}</td>
                      <td className="py-3 text-center">{percentOfReviews}%</td>
                      <td className="py-3 text-center text-positive">{theme.positive}</td>
                      <td className="py-3 text-center text-muted-foreground">{theme.neutral}</td>
                      <td className="py-3 text-center text-negative">{theme.negative}</td>
                      <td className="py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            theme.sentiment === "positive" ? "bg-transparent border-positive/40 text-positive" :
                            theme.sentiment === "negative" ? "bg-transparent border-negative/40 text-negative" :
                            "bg-transparent border-border text-muted-foreground"
                          }
                        >
                          {theme.sentiment}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
