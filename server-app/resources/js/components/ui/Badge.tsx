import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  rounded?: boolean;
}

const Badge = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  rounded = true
}: BadgeProps) => {
  const variantClasses = {
    primary: 'bg-primary-100 text-primary-800 border-primary-200',
    secondary: 'bg-secondary-100 text-secondary-800 border-secondary-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm',
  };

  const badgeClasses = `
    inline-flex items-center font-medium border
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${rounded ? 'rounded-full' : 'rounded-md'}
    ${className}
  `.trim();

  return (
    <span className={badgeClasses}>
      {children}
    </span>
  );
};

export default Badge;