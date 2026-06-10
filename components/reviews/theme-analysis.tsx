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
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>S26 Key Features Mentions</CardTitle>
          <CardDescription>Tracking mentions of the three flagship features in reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {s26Features.map((feature) => {
              const Icon = feature.icon
              const percentOfReviews = totalReviews > 0 ? ((feature.mentions / totalReviews) * 100).toFixed(1) : 0
              
              return (
                <div key={feature.name} className="flex items-center gap-4 rounded-lg border bg-background p-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${feature.bgColor}`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{feature.name}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{feature.mentions}</span>
                      <span className="text-xs text-muted-foreground">mentions</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{feature.positiveRate}% positive</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div 
                          className="h-full rounded-full bg-positive transition-all"
                          style={{ width: `${feature.positiveRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Theme Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {themes.slice(0, 5).map((theme) => {
          const Icon = themeIcons[theme.theme] || Minus
          const positivePercent = Math.round((theme.positive / theme.count) * 100)
          
          return (
            <Card key={theme.theme}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{theme.theme}</p>
                      <p className="text-xs text-muted-foreground">{theme.count} mentions</p>
                    </div>
                  </div>
                  <Badge variant={theme.sentiment === "positive" ? "default" : theme.sentiment === "negative" ? "destructive" : "secondary"}>
                    {positivePercent}%
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="flex gap-1 h-2">
                    <div 
                      className="bg-positive rounded-l"
                      style={{ width: `${(theme.positive / theme.count) * 100}%` }}
                    />
                    <div 
                      className="bg-muted-foreground/50"
                      style={{ width: `${(theme.neutral / theme.count) * 100}%` }}
                    />
                    <div 
                      className="bg-negative rounded-r"
                      style={{ width: `${(theme.negative / theme.count) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      {/* Top Themes Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Positive Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-positive" />
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-positive/10 text-positive font-medium text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{theme.theme}</span>
                        </div>
                        <span className="text-sm text-positive font-medium">{positivePercent}% positive</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-positive rounded-full"
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
              <ThumbsDown className="h-5 w-5 text-negative" />
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-negative/10 text-negative font-medium text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{theme.theme}</span>
                        </div>
                        <span className="text-sm text-negative font-medium">{negativePercent}% negative</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-negative rounded-full"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Theme</th>
                  <th className="pb-3 text-center font-medium">Mentions</th>
                  <th className="pb-3 text-center font-medium">% of Reviews</th>
                  <th className="pb-3 text-center font-medium">Positive</th>
                  <th className="pb-3 text-center font-medium">Neutral</th>
                  <th className="pb-3 text-center font-medium">Negative</th>
                  <th className="pb-3 text-center font-medium">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {themes.map((theme) => {
                  const Icon = themeIcons[theme.theme] || Minus
                  const percentOfReviews = totalReviews > 0 ? Math.round((theme.count / totalReviews) * 100) : 0
                  
                  return (
                    <tr key={theme.theme} className="border-b last:border-0">
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
                        <Badge variant={theme.sentiment === "positive" ? "default" : theme.sentiment === "negative" ? "destructive" : "secondary"}>
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
