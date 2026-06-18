import { Component } from "react";

/**
 * Catches render errors in a subtree so one panel failure does not white-screen the app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[CogniMesh ErrorBoundary]", this.props.name || "panel", error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      const title = this.props.name ? `${this.props.name} failed` : "Something went wrong";
      return (
        <div className="error-boundary" role="alert">
          <h3>{title}</h3>
          <p className="error-boundary-message">{this.state.error.message}</p>
          <button type="button" className="btn-secondary" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
