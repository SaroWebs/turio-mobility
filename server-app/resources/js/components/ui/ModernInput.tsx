import React, { InputHTMLAttributes } from 'react';

interface ModernInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const ModernInput = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = true,
  className = '',
  id,
  ...props
}: ModernInputProps) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const inputClasses = `
    modern-input
    ${leftIcon ? 'pl-10' : ''}
    ${rightIcon ? 'pr-10' : ''}
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim();

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-neutral-400 sm:text-sm">{leftIcon}</span>
          </div>
        )}

        <input
          id={inputId}
          className={inputClasses}
          {...props}
        />

        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-neutral-400 sm:text-sm">{rightIcon}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-1 text-sm text-neutral-500">{helperText}</p>
      )}
    </div>
  );
};

export default ModernInput;