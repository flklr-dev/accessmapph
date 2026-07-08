import accessmapLogo from '../../assets/accessmap-logo.png'
import { cn } from '../../lib/utils'

type LogoMarkProps = {
  className?: string
  size?: number
}

export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <img
      src={accessmapLogo}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
