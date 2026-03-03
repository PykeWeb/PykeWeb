import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/design-system'

export function Button({
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; icon?: ReactNode }) {
  if (variant === 'secondary') return <SecondaryButton {...props}>{children}</SecondaryButton>
  if (variant === 'ghost') return <GhostButton {...props}>{children}</GhostButton>
  return <PrimaryButton {...props}>{children}</PrimaryButton>
}
