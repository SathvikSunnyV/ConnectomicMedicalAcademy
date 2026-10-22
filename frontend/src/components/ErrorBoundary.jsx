import React from 'react';

// A render error anywhere in the tree below this (a bad API response shape,
// a null-reference in a page component, etc.) otherwise takes down the
// entire app to a blank white screen with no way to recover. This catches
// it and offers a reload instead. Deliberately simple -- it does not need
// to be elaborate, just needs to keep the app from going fully blank.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in app tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ textAlign: 'center' }}>
          <h2 className="mt-1">Something went wrong</h2>
          <p className="helper-text">An unexpected error occurred. Reloading usually fixes it.</p>
          <button className="btn btn-primary mt-1" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
