interface LegalLinksProps {
  className?: string
}

/** Links to the standalone Terms of Service and Privacy Policy pages, opened in a new tab. */
export function LegalLinks({ className }: LegalLinksProps) {
  return (
    <span className={className}>
      <a
        href="/legal/terms.html"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-semibold hover:underline"
      >
        Terms of Service
      </a>
      {' and '}
      <a
        href="/legal/privacy.html"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-semibold hover:underline"
      >
        Privacy Policy
      </a>
    </span>
  )
}
