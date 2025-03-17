// src/components/Button.tsx
import React from 'react';

type ButtonProps = {
    children: React.ReactNode;
    type?: 'button' | 'submit' | 'reset';
    onClick?: () => void;
    variant?: 'primary' | 'outline' | 'danger';
    fullWidth?: boolean;
    className?: string;
    disabled?: boolean;
};

const Button: React.FC<ButtonProps> = ({
                                           children,
                                           type = 'button',
                                           onClick,
                                           variant = 'primary',
                                           fullWidth = false,
                                           className = '',
                                           disabled = false,
                                       }) => {
    let baseStyles = 'py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ';

    if (variant === 'primary') {
        baseStyles += 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500 ';
    } else if (variant === 'outline') {
        baseStyles += 'border border-indigo-500 text-indigo-500 hover:bg-indigo-50 focus:ring-indigo-500 ';
    } else if (variant === 'danger') {
        baseStyles += 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 ';
    }

    if (fullWidth) {
        baseStyles += 'w-full ';
    }

    if (disabled) {
        baseStyles += 'opacity-50 cursor-not-allowed ';
    }

    return (
        <button
            type={type}
            onClick={onClick}
            className={`${baseStyles} ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

export default Button;