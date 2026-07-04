import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'

export type LegalDoc = 'terms' | 'privacy'

const proseClass = 'text-[13px] leading-relaxed text-ink-muted m-0'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink m-0">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function TermsContent() {
  return (
    <div className="space-y-5">
      <p className={proseClass}>
        Last updated: July 4, 2026. By creating an account or using AccessMap PH, you agree to these
        Terms of Service.
      </p>

      <Section title="1. Purpose">
        <p className={proseClass}>
          AccessMap PH is a community platform for sharing accessibility information about public
          places in the Philippines. Content is contributed by users and may be incomplete or
          outdated.
        </p>
      </Section>

      <Section title="2. Accounts">
        <p className={proseClass}>
          You must provide accurate information and keep your credentials secure. You are
          responsible for activity under your account. We may suspend accounts that abuse the
          service, post harmful content, or violate these terms.
        </p>
      </Section>

      <Section title="3. Community contributions">
        <p className={proseClass}>
          Reports and pins you submit must be truthful to the best of your knowledge. Do not post
          spam, harassment, personal data about others, or illegal content. You grant AccessMap PH a
          non-exclusive license to display and moderate your contributions for the service.
        </p>
      </Section>

      <Section title="4. No professional advice">
        <p className={proseClass}>
          Accessibility information is community-sourced and not a guarantee of conditions on site.
          Always assess places yourself when safety or access is critical.
        </p>
      </Section>

      <Section title="5. Availability">
        <p className={proseClass}>
          We aim for reliable service but do not guarantee uninterrupted access. Features may change
          as the product develops.
        </p>
      </Section>

      <Section title="6. Contact">
        <p className={proseClass}>
          Questions about these terms: use the project maintainers via the AccessMap PH repository
          or support email when published.
        </p>
      </Section>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div className="space-y-5">
      <p className={proseClass}>
        Last updated: July 4, 2026. This Privacy Policy explains what data AccessMap PH collects and
        how we use it.
      </p>

      <Section title="1. Data we collect">
        <p className={proseClass}>
          Account data (email, display name, profile photo if you sign in with Google), accessibility
          reports you submit, map pins you create, and basic usage data needed to run the service
          (such as authentication tokens and rate-limit counters).
        </p>
      </Section>

      <Section title="2. How we use data">
        <p className={proseClass}>
          We use your data to authenticate you, show community reports on the map, prevent abuse,
          improve the product, and communicate about your account (for example, email verification).
        </p>
      </Section>

      <Section title="3. Processors">
        <p className={proseClass}>
          Authentication is handled by Google Firebase. Location and report data are stored in our
          database (MongoDB Atlas). Map place search may use OpenStreetMap Nominatim. These providers
          process data under their own terms and privacy policies.
        </p>
      </Section>

      <Section title="4. Sharing">
        <p className={proseClass}>
          Reports and pins you contribute are visible to other users of AccessMap PH. We do not sell
          your personal information. We may disclose data if required by law.
        </p>
      </Section>

      <Section title="5. Retention">
        <p className={proseClass}>
          We keep account and contribution data while your account is active and as needed to operate
          the service. You may request account deletion by contacting the maintainers.
        </p>
      </Section>

      <Section title="6. Your choices">
        <p className={proseClass}>
          You can update your display name through your account provider, sign out at any time, and
          choose not to contribute reports. Email/password accounts must verify email before
          contributing.
        </p>
      </Section>

      <Section title="7. Contact">
        <p className={proseClass}>
          Privacy questions: contact the AccessMap PH maintainers via the project repository or
          support email when published.
        </p>
      </Section>
    </div>
  )
}

interface LegalDocModalProps {
  doc: LegalDoc | null
  onClose: () => void
}

export function LegalDocModal({ doc, onClose }: LegalDocModalProps) {
  return (
    <Modal
      open={doc !== null}
      onClose={onClose}
      title={doc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
      elevated
      className="max-w-lg"
    >
      {doc === 'terms' && <TermsContent />}
      {doc === 'privacy' && <PrivacyContent />}
    </Modal>
  )
}

interface LegalLinksProps {
  onOpen: (doc: LegalDoc) => void
  className?: string
}

export function LegalLinks({ onOpen, className }: LegalLinksProps) {
  return (
    <span className={className}>
      <button
        type="button"
        onClick={() => onOpen('terms')}
        className="text-primary font-semibold bg-transparent border-0 cursor-pointer p-0 hover:underline"
      >
        Terms of Service
      </button>
      {' and '}
      <button
        type="button"
        onClick={() => onOpen('privacy')}
        className="text-primary font-semibold bg-transparent border-0 cursor-pointer p-0 hover:underline"
      >
        Privacy Policy
      </button>
    </span>
  )
}
