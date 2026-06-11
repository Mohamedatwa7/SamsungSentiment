import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono, Source_Serif_4 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter'
});
const _geistMono = Geist_Mono({ subsets: ["latin"] });
// Editorial display face for headlines and large numerals (board-report look).
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: '--font-source-serif',
  axes: ['opsz'],
});

export const metadata: Metadata = {
  title: 'Samsung Customer Sentiment Intelligence',
  description: 'AI-powered customer sentiment analysis platform for Samsung',
  generator: 'Samsung Enterprise',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1428a0' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1628' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
