// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import Button from './Button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg text-center">
                    <h2 className="text-red-600 dark:text-red-300 text-xl mb-2">Что-то пошло не так</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        Произошла ошибка при загрузке компонента
                    </p>
                    <Button onClick={() => this.setState({ hasError: false })}>
                        Попробовать снова
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;