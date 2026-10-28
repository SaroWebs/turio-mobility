import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react'

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string
  icon?: ReactNode
  containerClassName?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  {
    label,
    hint,
    error,
    icon,
    id,
    name,
    type = 'text',
    className = '',
    containerClassName = '',
    required,
    disabled,
    ...rest
  },
  ref,
) {
  const inputId = id || name || label.toLowerCase().replace(/\s+/g, '-')
  const hasError = Boolean(error)

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-[#13231f]"
        >
          {label}
          {required && <span className="ml-1 text-[#b42318]">*</span>}
        </label>
        {hint && <span className="text-xs text-[#5b6964]">{hint}</span>}
      </div>

      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 flex items-center text-[#5b6964]">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : undefined}
          className={`min-h-[48px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-[#13231f] placeholder:text-[#8a9893] transition-colors focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20 disabled:bg-[#f7f8f5] disabled:cursor-not-allowed ${
            icon ? 'pl-11' : ''
          } ${
            hasError
              ? 'border-[#b42318] focus:border-[#b42318] focus:outline-[#b42318]/20'
              : 'border-[#dbe1dc]'
          } ${className}`}
          {...rest}
        />
      </div>

      {hasError && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  )
})
