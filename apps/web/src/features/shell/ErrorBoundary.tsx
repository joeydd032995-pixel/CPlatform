'use client';

import { Component, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/90 p-5">
          <Alert variant="destructive">
            <AlertDescription>
              Something went wrong rendering this game. Try reloading the page.
            </AlertDescription>
          </Alert>
          <Button
            className="w-fit"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
