import { useState } from "react"
import type { ComponentProps } from "react"
import { Eye, EyeOff, Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./input"

interface PasswordInputProps extends Omit<ComponentProps<typeof Input>, "type"> {
  showLockIcon?: boolean
}

function PasswordInput({ className, showLockIcon = true, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {showLockIcon && (
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-on-surface-variant" />
      )}
      <Input
        type={visible ? "text" : "password"}
        className={cn(showLockIcon && "pl-10", "pr-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
