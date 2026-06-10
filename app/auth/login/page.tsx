'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { Mail, Lock, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'

// Whitelisted emails with hardcoded OTPs (bypass Supabase rate limits)
const HARDCODED_OTPS: Record<string, string> = {
  'm.atwa@samsung.com': '18508',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isHardcodedUser, setIsHardcodedUser] = useState(false)

  const validateSamsungEmail = (email: string) => {
    const samsungDomains = ['@samsung.com', '@partner.samsung.com']
    return samsungDomains.some(domain => email.toLowerCase().endsWith(domain))
  }
  
  const isHardcodedEmail = (email: string) => {
    return email.toLowerCase() in HARDCODED_OTPS
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!validateSamsungEmail(email)) {
      setError('Please use a valid @samsung.com or @partner.samsung.com email address')
      return
    }

    // Check if this is a hardcoded user (bypass Supabase)
    if (isHardcodedEmail(email)) {
      setIsHardcodedUser(true)
      setStep('otp')
      setSuccessMessage(`Enter your verification code`)
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setStep('otp')
      setSuccessMessage(`We've sent a 6-digit code to ${email}`)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to send verification code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Handle hardcoded users - bypass Supabase entirely
      if (isHardcodedUser) {
        const expectedOtp = HARDCODED_OTPS[email.toLowerCase()]
        if (otp === expectedOtp) {
          // Set a bypass session cookie for hardcoded users
          document.cookie = `samsung_auth_bypass=${btoa(email.toLowerCase())};path=/;max-age=86400;samesite=lax`
          window.location.href = '/dashboard'
          return
        } else {
          throw new Error('Invalid verification code')
        }
      }

      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })

      if (error) throw error

      // Redirect will happen automatically via middleware
      window.location.href = '/dashboard'
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Invalid or expired code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setSuccessMessage('A new code has been sent to your email')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to resend code')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              {step === 'email' ? (
                <Mail className="h-7 w-7 text-primary" />
              ) : (
                <Lock className="h-7 w-7 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {step === 'email' ? 'Welcome' : 'Enter Verification Code'}
            </CardTitle>
            <CardDescription>
              {step === 'email' 
                ? 'Sign in with your Samsung email to access the dashboard'
                : successMessage
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={handleSendOTP}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@samsung.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={error ? 'border-destructive' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Only @samsung.com emails are allowed
                    </p>
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder={isHardcodedUser ? "Enter 5-digit code" : "Enter 6-digit code"}
                      required
                      maxLength={isHardcodedUser ? 5 : 6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className={`text-center text-xl tracking-widest ${error ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  {successMessage && !error && (
                    <div className="flex items-center gap-2 text-sm text-positive">
                      <CheckCircle2 className="h-4 w-4" />
                      {successMessage}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length !== (isHardcodedUser ? 5 : 6)}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('email')
                        setOtp('')
                        setError(null)
                        setSuccessMessage(null)
                        setIsHardcodedUser(false)
                      }}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Change email
                    </button>
                    {!isHardcodedUser && (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={isLoading}
                        className="text-primary hover:underline disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Samsung Social Reviews Dashboard
        </p>
      </div>
    </div>
  )
}
