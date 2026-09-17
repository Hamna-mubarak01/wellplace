"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react"

const BADGE =
  "flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4 [&>svg]:stroke-[2.5]"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      closeButton
      className="toaster group"
      icons={{
        success: (
          <span className={`${BADGE} bg-success text-success-wash`}>
            <CheckIcon aria-hidden="true" />
          </span>
        ),
        info: (
          <span className={`${BADGE} bg-info text-info-wash`}>
            <InfoIcon aria-hidden="true" />
          </span>
        ),
        warning: (
          <span className={`${BADGE} bg-warning text-warning-wash`}>
            <TriangleAlertIcon aria-hidden="true" />
          </span>
        ),
        error: (
          <span className={`${BADGE} bg-danger text-danger-wash`}>
            <CircleAlertIcon aria-hidden="true" />
          </span>
        ),
        loading: (
          <span className={`${BADGE} bg-surface-active text-text-secondary`}>
            <Loader2Icon aria-hidden="true" className="animate-spin" />
          </span>
        ),
      }}
      style={
        {
          "--width": "var(--measure-toast)",
          "--normal-bg": "var(--surface-raised)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border-strong)",
          "--border-radius": "var(--radius-card)",

          "--error-bg": "var(--danger-wash)",
          "--error-text": "var(--danger-ink)",
          "--error-border": "var(--danger-border)",

          "--warning-bg": "var(--warning-wash)",
          "--warning-text": "var(--warning-ink)",
          "--warning-border": "var(--warning-border)",

          "--info-bg": "var(--info-wash)",
          "--info-text": "var(--info-ink)",
          "--info-border": "var(--info-border)",

          "--success-bg": "var(--success-wash)",
          "--success-text": "var(--success-ink)",
          "--success-border": "var(--success-border)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "wp-toast" } }}
      {...props}
    />
  )
}

export { Toaster }
