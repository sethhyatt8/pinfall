import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  full?: boolean
}

export function Button({ variant = 'secondary', full = false, className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`btn btn-${variant} ${full ? 'btn-full' : ''} ${className}`} {...props} />
}

export function TextField({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Dialog({
  open,
  title,
  children,
  onClose,
  dismissable = true,
  sheet = false,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  dismissable?: boolean
  sheet?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let ignoreClose = false
    if (open) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      ignoreClose = true
      el.close()
    }
    const handleClose = () => {
      if (!ignoreClose) onCloseRef.current()
    }
    el.addEventListener('close', handleClose)
    return () => {
      ignoreClose = true
      el.removeEventListener('close', handleClose)
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={sheet ? 'sheet' : 'modal'}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (!dismissable) event.preventDefault()
      }}
      onClick={(event) => {
        if (dismissable && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        {dismissable ? (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        ) : null}
      </div>
      {children}
    </dialog>
  )
}
