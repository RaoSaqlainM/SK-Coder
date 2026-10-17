import React, { ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
interface Props {
    children: ReactNode;
}
interface State {
    hasError: boolean;
    error: Error | null;
}
export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error) {
        console.error('Error caught by boundary:', error);
    }
    reset = () => {
        this.setState({ hasError: false, error: null });
    };
    render() {
        if (this.state.hasError) {
            return (<div className="flex items-center justify-center min-h-screen bg-background">
          <div className="max-w-md w-full mx-auto p-6 bg-surface rounded-lg border border-border">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-error"/>
              <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            </div>
            <p className="text-sm text-muted mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={this.reset} className="w-full flex items-center justify-center gap-2 bg-primary text-background px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              <RotateCcw className="w-4 h-4"/>
              Try Again
            </button>
          </div>
        </div>);
        }
        return this.props.children;
    }
}
