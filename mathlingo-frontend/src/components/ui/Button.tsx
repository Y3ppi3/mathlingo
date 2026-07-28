// src/components/ui/Button.tsx
// Тактильная «объёмная» кнопка в духе Duolingo: скруглённая, жирная, с нижней
// кромкой-«губой», которая вдавливается при нажатии (см. .btn-3d в index.css).
import React from 'react';

type Variant = 'primary' | 'success' | 'sky' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = {
    children: React.ReactNode;
    type?: 'button' | 'submit' | 'reset';
    onClick?: () => void;
    variant?: Variant;
    size?: Size;
    fullWidth?: boolean;
    className?: string;
    disabled?: boolean;
    'aria-label'?: string;
};

// Цвет фона + тёмная нижняя кромка + фокус-кольцо на вариант.
const VARIANT: Record<Variant, string> = {
    primary: 'bg-brand hover:bg-brand-dark border-brand-deep text-white focus-visible:ring-brand-light',
    success: 'bg-feather hover:brightness-105 border-feather-shade text-white focus-visible:ring-feather-light',
    sky:     'bg-macaw hover:brightness-105 border-macaw-shade text-white focus-visible:ring-macaw-light',
    danger:  'bg-cardinal hover:brightness-105 border-cardinal-shade text-white focus-visible:ring-cardinal',
    outline: 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-100 focus-visible:ring-gray-300',
    // ghost — без объёма (плоская), для второстепенных действий.
    ghost:   'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent text-gray-600 dark:text-gray-300 focus-visible:ring-gray-300 active:translate-y-0 active:border-b-4',
};

const SIZE: Record<Size, string> = {
    sm: 'text-sm px-4 py-2',
    md: 'text-base px-5 py-2.5',
    lg: 'text-lg px-8 py-3.5',
};

const Button: React.FC<ButtonProps> = ({
    children,
    type = 'button',
    onClick,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    disabled = false,
    'aria-label': ariaLabel,
}) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`btn-3d ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
        {children}
    </button>
);

export default Button;
