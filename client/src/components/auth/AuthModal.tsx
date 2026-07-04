import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import {
  needsEmailVerification,
  reloadCurrentUser,
  resendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from '../../lib/authActions'
import { checkAuthRateLimit } from '../../lib/authRateLimit'
import { setAuthSessionUser } from '../../lib/authSession'
import { isFirebaseConfigured } from '../../lib/firebase'
import { fetchCurrentUser } from '../../api/auth'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { Button } from '../ui/Button'
import { GoogleIcon } from './GoogleIcon'
import { LegalLinks } from './LegalDocs'
import { cn } from '../../lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Mode = 'signin' | 'signup'
type PendingMethod = 'email' | 'google' | 'resend' | 'check' | null

type FieldErrors = {
  displayName?: string
  email?: string
  password?: string
  terms?: string
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full px-3 py-2.5 text-[15px] text-ink bg-white border rounded-md transition-colors',
    'focus:outline-none focus:shadow-[0_0_0_3px_var(--color-blue-50)]',
    hasError
      ? 'border-red-500 hover:border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_var(--color-red-50)]'
      : 'border-border hover:border-gray-400 focus:border-primary',
  )
}

function validateForm(
  mode: Mode,
  values: {
    displayName: string
    email: string
    password: string
    agreedToTerms: boolean
  },
): FieldErrors {
  const errors: FieldErrors = {}
  const email = values.email.trim()
  const password = values.password
  const displayName = values.displayName.trim()

  if (mode === 'signup') {
    if (!displayName) {
      errors.displayName = 'Display name is required.'
    } else if (displayName.length < 2) {
      errors.displayName = 'Display name must be at least 2 characters.'
    } else if (displayName.length > 80) {
      errors.displayName = 'Display name must be 80 characters or fewer.'
    }

    if (!values.agreedToTerms) {
      errors.terms = 'You must agree to the Terms of Service and Privacy Policy.'
    }
  }

  if (!email) {
    errors.email = 'Email is required.'
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.'
  } else if (mode === 'signup' && password.length > 128) {
    errors.password = 'Password must be 128 characters or fewer.'
  }

  return errors
}

export function AuthModal() {
  const isOpen = useAuthStore((s) => s.isAuthModalOpen)
  const message = useAuthStore((s) => s.authModalMessage)
  const firebaseUser = useAuthStore((s) => s.firebaseUser)
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal)
  const runPendingAction = useAuthStore((s) => s.runPendingAction)

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingMethod>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showVerifyPanel, setShowVerifyPanel] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const isBusy = pending !== null
  const isEmailPending = pending === 'email'
  const isGooglePending = pending === 'google'
  const awaitingVerification =
    showVerifyPanel || needsEmailVerification(firebaseUser)

  const clearForm = (nextMode: Mode = 'signin') => {
    setMode(nextMode)
    setEmail('')
    setPassword('')
    setDisplayName('')
    setFieldErrors({})
    setFormError(null)
    setInfo(null)
    setPending(null)
    setShowVerifyPanel(false)
    setAgreedToTerms(false)
  }

  // Reset only when the modal opens — not when firebaseUser updates mid-flow.
  useEffect(() => {
    if (!isOpen) return
    setFieldErrors({})
    setFormError(null)
    setInfo(null)
    setPending(null)
    setMode('signin')
    setEmail('')
    setPassword('')
    setDisplayName('')
    setAgreedToTerms(false)
    setShowVerifyPanel(needsEmailVerification(firebaseUser))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on open
  }, [isOpen])

  useEffect(() => {
    if (isOpen && needsEmailVerification(firebaseUser)) {
      setShowVerifyPanel(true)
    }
  }, [isOpen, firebaseUser])

  const handleClose = () => {
    if (isBusy) return
    clearForm('signin')
    closeAuthModal()
  }

  const switchMode = (nextMode: Mode) => {
    if (isBusy) return
    clearForm(nextMode)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isBusy) return

    setFormError(null)
    setInfo(null)

    const errors = validateForm(mode, { displayName, email, password, agreedToTerms })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const rate = checkAuthRateLimit('email')
    if (!rate.allowed) {
      setFormError(
        `Too many attempts. Wait ${rate.retryAfterSec}s before trying again.`,
      )
      return
    }

    setPending('email')

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        const result = await signUpWithEmail(email, password, displayName)
        setShowVerifyPanel(true)
        setPassword('')
        if (result.verificationSent) {
          setInfo(
            'We sent a verification link. Check your inbox and spam folder, then click “I’ve verified”.',
          )
        } else {
          setFormError(
            result.verificationError ??
              'Account created, but the verification email could not be sent. Use Resend below.',
          )
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setPending(null)
    }
  }

  const handleGoogle = async () => {
    if (isBusy) return

    setFieldErrors({})
    setFormError(null)
    setInfo(null)

    const rate = checkAuthRateLimit('google')
    if (!rate.allowed) {
      setFormError(
        `Too many Google sign-in attempts. Wait ${rate.retryAfterSec}s before trying again.`,
      )
      return
    }

    setPending('google')
    try {
      await signInWithGoogle()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-in failed.')
    } finally {
      setPending(null)
    }
  }

  const handleResend = async () => {
    if (isBusy) return
    setFormError(null)
    setInfo(null)

    const rate = checkAuthRateLimit('email')
    if (!rate.allowed) {
      setFormError(
        `Too many emails sent. Wait ${rate.retryAfterSec}s before resending.`,
      )
      return
    }

    setPending('resend')
    try {
      await resendVerificationEmail()
      setInfo('Verification email sent again. Check inbox and spam.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not resend email.')
    } finally {
      setPending(null)
    }
  }

  const handleCheckVerified = async () => {
    if (isBusy) return
    setFormError(null)
    setInfo(null)
    setPending('check')

    try {
      const user = await reloadCurrentUser()
      setAuthSessionUser(user)
      setFirebaseUser(user)

      if (!user?.emailVerified) {
        setFormError(
          'Email not verified yet. Open the link in your email (check spam), then try again.',
        )
        return
      }

      // Force a fresh ID token so the server sees email_verified: true
      await user.getIdToken(true)
      const profile = await fetchCurrentUser()
      setProfile(profile)
      setShowVerifyPanel(false)
      setInfo(null)
      runPendingAction()
      closeAuthModal()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not check verification.')
    } finally {
      setPending(null)
    }
  }

  const handleSignOut = async () => {
    if (isBusy) return
    await signOutUser()
    clearForm('signin')
  }

  const title = awaitingVerification
    ? 'Verify your email'
    : mode === 'signin'
      ? 'Sign in'
      : 'Create account'

  return (
    <Modal open={isOpen} onClose={handleClose} title={title}>
      {!isFirebaseConfigured() ? (
        <p className="text-[15px] text-ink-muted m-0 leading-relaxed">
          Auth is not configured yet. Add Firebase keys to{' '}
          <code className="text-xs bg-surface-1 px-1.5 py-0.5 rounded-sm">client/.env</code>.
        </p>
      ) : awaitingVerification ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 px-3.5 py-3 rounded-md bg-surface-1 border border-border">
            <Mail size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink m-0">
                Confirm {firebaseUser?.email ?? 'your email'}
              </p>
              <p className="text-[13px] leading-relaxed text-ink-muted m-0 mt-1.5">
                Firebase sends the link from{' '}
                <span className="font-medium text-ink">noreply@accessmapph.firebaseapp.com</span>.
                It often lands in <span className="font-medium text-ink">Spam / Promotions</span>.
                Open the link, then tap “I’ve verified” below.
              </p>
            </div>
          </div>

          {message && (
            <p className="text-[13px] leading-relaxed text-ink-muted m-0 px-3.5 py-3 rounded-md bg-surface-1 border border-border">
              {message}
            </p>
          )}

          {formError && (
            <p
              className="text-sm text-red-500 m-0 leading-relaxed px-3 py-2.5 rounded-md bg-red-50 border border-red-500/20"
              role="alert"
            >
              {formError}
            </p>
          )}
          {info && (
            <p
              className="text-sm text-green-500 m-0 leading-relaxed px-3 py-2.5 rounded-md bg-green-50 border border-green-500/20"
              role="status"
            >
              {info}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={handleCheckVerified}
              disabled={isBusy}
            >
              {pending === 'check' ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Checking…
                </>
              ) : (
                'I’ve verified'
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleResend}
              disabled={isBusy}
            >
              {pending === 'resend' ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                'Resend verification email'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleSignOut}
              disabled={isBusy}
            >
              Use a different account
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {message && (
            <div className="mb-6 px-3.5 py-3 rounded-md bg-surface-1 border border-border">
              <p className="text-[13px] leading-relaxed text-ink-muted m-0">{message}</p>
            </div>
          )}

          <div className="flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {mode === 'signup' && (
                <Field
                  label="Display name"
                  htmlFor="auth-name"
                  error={fieldErrors.displayName}
                >
                  <input
                    id="auth-name"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      if (fieldErrors.displayName) {
                        setFieldErrors((prev) => ({ ...prev, displayName: undefined }))
                      }
                    }}
                    className={inputClass(Boolean(fieldErrors.displayName))}
                    autoComplete="name"
                    disabled={isBusy}
                    aria-invalid={fieldErrors.displayName ? true : undefined}
                  />
                </Field>
              )}

              <Field label="Email" htmlFor="auth-email" error={fieldErrors.email}>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }))
                    }
                  }}
                  className={inputClass(Boolean(fieldErrors.email))}
                  autoComplete="email"
                  disabled={isBusy}
                  aria-invalid={fieldErrors.email ? true : undefined}
                />
              </Field>

              <Field
                label="Password"
                htmlFor="auth-password"
                hint={mode === 'signup' ? 'At least 6 characters' : undefined}
                error={fieldErrors.password}
              >
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                  className={inputClass(Boolean(fieldErrors.password))}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  disabled={isBusy}
                  aria-invalid={fieldErrors.password ? true : undefined}
                />
              </Field>

              {mode === 'signup' ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="auth-terms" className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      id="auth-terms"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => {
                        setAgreedToTerms(e.target.checked)
                        if (fieldErrors.terms) {
                          setFieldErrors((prev) => ({ ...prev, terms: undefined }))
                        }
                      }}
                      disabled={isBusy}
                      className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
                      aria-invalid={fieldErrors.terms ? true : undefined}
                    />
                    <span
                      className={cn(
                        'text-[13px] leading-relaxed',
                        fieldErrors.terms ? 'text-red-500' : 'text-ink',
                      )}
                    >
                      I agree to the <LegalLinks /> and consent to the processing of my data as
                      described.
                    </span>
                  </label>
                  {fieldErrors.terms && (
                    <p className="text-sm text-red-500 m-0" role="alert">
                      {fieldErrors.terms}
                    </p>
                  )}
                </div>
              ) : null}

              {formError && (
                <p
                  className="text-sm text-red-500 m-0 leading-relaxed px-3 py-2.5 rounded-md bg-red-50 border border-red-500/20"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              {info && (
                <p
                  className="text-sm text-green-500 m-0 leading-relaxed px-3 py-2.5 rounded-md bg-green-50 border border-green-500/20"
                  role="status"
                >
                  {info}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-1"
                disabled={isBusy || (mode === 'signup' && !agreedToTerms)}
                aria-busy={isEmailPending || undefined}
              >
                {isEmailPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : mode === 'signin' ? (
                  'Sign in'
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            <div className="flex items-center gap-3" role="separator" aria-label="or">
              <span className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-ink-muted shrink-0">or</span>
              <span className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={isBusy}
              aria-busy={isGooglePending || undefined}
              className={cn(
                'w-full inline-flex items-center justify-center gap-3 min-h-11 px-4',
                'rounded-md border border-[#dadce0] bg-white',
                'text-[15px] font-medium text-[#3c4043]',
                'hover:bg-[#f8f9fa] hover:border-[#d2d3d4] hover:shadow-[0_1px_2px_rgba(60,64,67,0.15)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                'active:bg-[#f1f3f4]',
                'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
                'cursor-pointer transition-[background-color,box-shadow,border-color] duration-150',
              )}
            >
              {isGooglePending ? (
                <Loader2 size={18} className="animate-spin text-[#5f6368]" aria-hidden="true" />
              ) : (
                <GoogleIcon size={18} />
              )}
              {isGooglePending ? 'Connecting to Google…' : 'Continue with Google'}
            </button>

            <p className="text-sm text-ink-muted m-0 text-center leading-relaxed pt-1">
              {mode === 'signin' ? (
                <>
                  New here?{' '}
                  <button
                    type="button"
                    className="text-primary font-semibold bg-transparent border-0 cursor-pointer p-0 hover:underline disabled:opacity-45 disabled:cursor-not-allowed disabled:no-underline"
                    onClick={() => switchMode('signup')}
                    disabled={isBusy}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-primary font-semibold bg-transparent border-0 cursor-pointer p-0 hover:underline disabled:opacity-45 disabled:cursor-not-allowed disabled:no-underline"
                    onClick={() => switchMode('signin')}
                    disabled={isBusy}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
