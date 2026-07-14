// src/components/Input.tsx
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

const Input = ({
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
               }: InputProps) => {
    return (
        <div className="mb-4">
            {label && (
                <label
                    htmlFor={id || name}
                    className="block mb-1 font-medium text-gray-600 dark:text-slate-400 transition-colors"
                >
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
                className={`
                    w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all
                    bg-gray-50 dark:bg-slate-900/80
                    text-gray-900 dark:text-white
                    border border-gray-300 dark:border-slate-600
                    placeholder-gray-400 dark:placeholder-slate-500
                    focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${error ? 'border-red-400 focus:ring-red-400' : ''}
                    ${className}
                `}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
};

export default Input;