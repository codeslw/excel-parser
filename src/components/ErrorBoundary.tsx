import {Component} from 'react';

class ErrorBoundary extends Component<any, any> {
    state = { hasError: false, error: null, errorInfo: null };


    static getDerivedStateFromError(error: Error) {
        // Update state to show fallback UI
        return { hasError: true, error : error.name, errorInfo: error.message };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log the error or handle it here
        console.error('Error caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return <div className={"flex flex-col w-full space-y-5 text-red-400"}>
                <h4 className={"font-semibold"}>
                    {this.state.error}
                </h4>
                <p>
                    {this.state.errorInfo}
                </p>
            </div>
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
