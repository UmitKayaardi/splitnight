import { Component, type ReactNode } from 'react';
import { Trans } from 'react-i18next';
import i18n from '../i18n';
import { useBill } from '../state/bill';

interface State {
  failed: boolean;
}

/**
 * Last line of defence. Shows a friendly message (never a stack trace) and a
 * "Start over" button that throws the in-memory bill away.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[SplitNight] UI error:', error.name);
  }

  private startOver = () => {
    useBill.getState().reset();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p aria-hidden className="text-6xl">
          🌙
        </p>
        <h1 className="font-display text-3xl font-bold">
          <Trans i18n={i18n} i18nKey="errors.boundaryTitle" />
        </h1>
        <p className="text-muted">
          <Trans i18n={i18n} i18nKey="errors.boundaryBody" />
        </p>
        <button
          type="button"
          onClick={this.startOver}
          className="min-h-12 rounded-2xl bg-primary px-6 font-display text-lg font-semibold text-primary-fg"
        >
          <Trans i18n={i18n} i18nKey="errors.startOver" />
        </button>
      </main>
    );
  }
}
