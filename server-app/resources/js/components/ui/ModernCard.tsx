import React from 'react';

interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const ModernCard = ({
  children,
  className = '',
  hover = true,
  padding = 'md',
  shadow = 'md',
  animate = false
}: ModernCardProps) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  };

  const cardClasses = `
    modern-card bg-white rounded-xl border border-neutral-200
    ${paddingClasses[padding]}
    ${shadowClasses[shadow]}
    ${hover ? 'transition-all duration-300 hover:shadow-lg hover:-translate-y-1' : ''}
    ${animate ? 'animate-fade-in' : ''}
    ${className}
  `.trim();

  return (
    <div className={cardClasses}>
      {children}
    </div>
  );
};

// Card Header Component
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader = ({ children, className = '' }: CardHeaderProps) => (
  <div className={`pb-4 ${className}`}>
    {children}
  </div>
);

// Card Title Component
interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const CardTitle = ({ children, className = '', level = 3 }: CardTitleProps) => {
  const headingClasses = `font-semibold text-neutral-900 ${className}`;

  switch (level) {
    case 1:
      return <h1 className={headingClasses}>{children}</h1>;
    case 2:
      return <h2 className={headingClasses}>{children}</h2>;
    case 3:
      return <h3 className={headingClasses}>{children}</h3>;
    case 4:
      return <h4 className={headingClasses}>{children}</h4>;
    case 5:
      return <h5 className={headingClasses}>{children}</h5>;
    case 6:
      return <h6 className={headingClasses}>{children}</h6>;
    default:
      return <h3 className={headingClasses}>{children}</h3>;
  }
};

// Card Description Component
interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardDescription = ({ children, className = '' }: CardDescriptionProps) => (
  <p className={`text-neutral-600 text-sm mt-1 ${className}`}>
    {children}
  </p>
);

// Card Content Component
interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent = ({ children, className = '' }: CardContentProps) => (
  <div className={`pt-0 ${className}`}>
    {children}
  </div>
);

export default ModernCard;