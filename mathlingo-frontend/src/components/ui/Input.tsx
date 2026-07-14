// src/components/Input.tsx
import React from 'react';

type InputProps = {
    type?: string;
    placeholder?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    name?: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    label?: string;
    error?: string;
};

const Input: React.FC<InputProps> = ({
                                         type = 'text',
                                         placeholder,
                                         value,
                                         onChange,
                                         name,
                                         id,
                                         required = false,
                                         disabled = false,
                                         className = '',
                                         label,
                                         error,
                                     }) => {
    const baseStyles = 'w-full p-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-indigo-500 ';
    const darkModeStyles = 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-600 dark:border-gray-300 ';
    const errorStyles = error ? 'border-red-500 focus:ring-red-500' : '';

    return (
        <div className="mb-4">
            {label && (
                <label htmlFor={id || name} className="block mb-1 font-medium text-gray-400 dark:text-gray-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                name={name}
                id={id || name}
                required={required}
                disabled={disabled}
                className={`${baseStyles} ${darkModeStyles} ${errorStyles} ${className}`}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
};

export default Input;