import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export const Card = ({ children, className = "", title, subtitle, action }: CardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors ${className}`}>
      {(title || action) && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            {title && <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
};

export default Card;