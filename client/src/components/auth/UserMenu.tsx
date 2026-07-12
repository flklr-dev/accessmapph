import { useState, useRef, useEffect } from 'react'
import { FileText, LogOut, Shield, User, UserCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { signOutUser } from '../../lib/authActions'
import { LEVEL_LABELS } from '../../types/auth'
import { cn } from '../../lib/utils'

interface UserMenuProps {
  variant?: 'light' | 'dark'
}

export function UserMenu({ variant = 'light' }: UserMenuProps) {
  const firebaseUser = useAuthStore((s) => s.firebaseUser)
  const profile = useAuthStore((s) => s.profile)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const openProfileModal = useAuthStore((s) => s.openProfileModal)
  const loading = useAuthStore((s) => s.loading)

  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Firebase already provides the user's identity and avatar. Do not hide it
  // while the slower API profile request loads points and contribution data.
  if (loading && !firebaseUser) {
    return (
      <div
        className={cn(
          'w-10 h-10 rounded-md border animate-pulse',
          variant === 'dark' ? 'border-white/10 bg-white/5' : 'border-border bg-surface-1',
        )}
        aria-hidden="true"
      />
    )
  }

  if (!firebaseUser) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        className={cn(
          'inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md border text-sm font-semibold cursor-pointer transition-colors',
          variant === 'dark'
            ? 'border-white/15 bg-white/5 text-sidebar-text hover:bg-white/10'
            : 'border-border bg-white text-ink hover:bg-surface-1',
        )}
        aria-label="Sign in"
      >
        <User size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    )
  }

  const label = profile?.displayName || firebaseUser.displayName || 'You'
  const photo = profile?.photoURL || firebaseUser.photoURL

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-center w-10 h-10 rounded-md border overflow-hidden cursor-pointer',
          variant === 'dark'
            ? 'border-white/15 bg-white/5 hover:bg-white/10'
            : 'border-border bg-white hover:bg-surface-1',
        )}
        aria-label={`Account menu for ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            width={40}
            height={40}
            fetchPriority="high"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className={cn(
              'text-xs font-bold',
              variant === 'dark' ? 'text-sidebar-text' : 'text-primary',
            )}
          >
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-56 rounded-md border border-border bg-canvas shadow-elevated z-dropdown p-1"
        >
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-sm font-semibold text-ink m-0 truncate">{label}</p>
            <p className="text-xs text-ink-muted m-0 truncate">{firebaseUser.email}</p>
            {profile && (
              <p className="text-[11px] text-ink-muted m-0 mt-1">
                {LEVEL_LABELS[profile.level]} · {profile.points} pts
              </p>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              openProfileModal()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink rounded-sm hover:bg-surface-1 border-0 bg-transparent cursor-pointer text-left"
          >
            <UserCircle size={14} aria-hidden="true" />
            View profile
          </button>
          <div className="my-1 border-t border-border" role="separator" />
          <a
            href="/legal/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink rounded-sm hover:bg-surface-1 no-underline"
          >
            <Shield size={14} aria-hidden="true" />
            Privacy Policy
          </a>
          <a
            href="/legal/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink rounded-sm hover:bg-surface-1 no-underline"
          >
            <FileText size={14} aria-hidden="true" />
            Terms &amp; Conditions
          </a>
          <div className="my-1 border-t border-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false)
              await signOutUser()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink rounded-sm hover:bg-surface-1 border-0 bg-transparent cursor-pointer text-left"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
