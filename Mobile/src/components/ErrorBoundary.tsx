import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getErrorMessage } from '../utils/errorHandlers';
import {
  buildIssueMailtoUrl,
  captureError,
  type BoundaryLevel,
} from '../lib/sentry';

interface ReportIssuePayload {
  correlationId: string;
  error: Error;
  componentStack?: string;
  level: BoundaryLevel;
  boundaryName?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  level?: BoundaryLevel;
  boundaryName?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void | Promise<void>;
  onSoftRefresh?: () => void | Promise<void>;
  onReportIssue?: (payload: ReportIssuePayload) => void | Promise<void>;
}

interface ErrorBoundaryState {
  error: Error | null;
  correlationId: string | null;
  componentStack?: string;
  resetCounter: number;
  reporting: boolean;
}

const INITIAL_STATE: ErrorBoundaryState = {
  error: null,
  correlationId: null,
  componentStack: undefined,
  resetCounter: 0,
  reporting: false,
};

function getDefaultTitle(level: BoundaryLevel): string {
  switch (level) {
    case 'app':
      return 'Something went wrong';
    case 'widget':
      return 'This block could not load';
    default:
      return 'This section hit a snag';
  }
}

function getDefaultMessage(level: BoundaryLevel): string {
  switch (level) {
    case 'app':
      return 'Try restarting this session. If the issue keeps happening, report it with the correlation id below.';
    case 'widget':
      return 'Retry this block, refresh it softly, or report the issue if it keeps happening.';
    default:
      return 'Retry this section, refresh it softly, or report the issue if it keeps happening.';
  }
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const level = this.props.level ?? 'feature';
    const correlationId = captureError(error, {
      correlationId: this.state.correlationId ?? undefined,
      surface: this.props.boundaryName ?? 'mobile-boundary',
      level,
      componentStack: info.componentStack ?? '',
    });

    this.setState({
      correlationId,
      componentStack: info.componentStack ?? '',
    });
  }

  private resetBoundary = async () => {
    try {
      await this.props.onRetry?.();
    } finally {
      this.setState((currentState) => ({
        ...INITIAL_STATE,
        resetCounter: currentState.resetCounter + 1,
      }));
    }
  };

  private softRefresh = async () => {
    if (!this.props.onSoftRefresh) {
      return;
    }

    try {
      await this.props.onSoftRefresh();
    } finally {
      this.setState((currentState) => ({
        ...INITIAL_STATE,
        resetCounter: currentState.resetCounter + 1,
      }));
    }
  };

  private reportIssue = async () => {
    const { error, correlationId, componentStack } = this.state;

    if (!error || !correlationId) {
      return;
    }

    this.setState({ reporting: true });

    try {
      const payload: ReportIssuePayload = {
        correlationId,
        error,
        componentStack,
        level: this.props.level ?? 'feature',
        boundaryName: this.props.boundaryName,
      };

      if (this.props.onReportIssue) {
        await this.props.onReportIssue(payload);
        return;
      }

      const url = buildIssueMailtoUrl({
        correlationId,
        error,
        context: {
          surface: this.props.boundaryName,
          level: this.props.level ?? 'feature',
          componentStack,
        },
      });

      const canOpen = await Linking.canOpenURL(url).catch(() => false);

      if (!canOpen) {
        Alert.alert(
          'Unable to open email app',
          `Share this correlation id with support: ${correlationId}`,
        );
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Issue reporting failed',
        correlationId
          ? `Share this correlation id with support: ${correlationId}`
          : 'Please try again.',
      );
    } finally {
      this.setState({ reporting: false });
    }
  };

  render() {
    const { children, level = 'feature' } = this.props;
    const { error, correlationId, resetCounter, reporting } = this.state;

    if (!error) {
      return (
        <React.Fragment key={`boundary-reset-${resetCounter}`}>
          {children}
        </React.Fragment>
      );
    }

    const isAppLevel = level === 'app';
    const isWidgetLevel = level === 'widget';

    return (
      <View
        style={[
          styles.shell,
          isAppLevel ? styles.appShell : styles.inlineShell,
        ]}
      >
        <View
          style={[
            styles.card,
            isAppLevel ? styles.appCard : styles.inlineCard,
            isWidgetLevel ? styles.widgetCard : null,
          ]}
        >
          <Text style={styles.eyebrow}>
            {isAppLevel ? 'Fatal fallback' : isWidgetLevel ? 'Widget fallback' : 'Feature fallback'}
          </Text>
          <Text style={styles.title}>
            {this.props.fallbackTitle ?? getDefaultTitle(level)}
          </Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage ?? getDefaultMessage(level)}
          </Text>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Correlation ID</Text>
            <Text style={styles.metaValue}>{correlationId ?? 'Pending...'}</Text>
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Error</Text>
            <Text style={styles.metaValue}>
              {getErrorMessage(error, 'Unexpected error')}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={this.resetBoundary} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>

            {!isAppLevel && this.props.onSoftRefresh ? (
              <Pressable onPress={this.softRefresh} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Soft refresh section</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={this.reportIssue}
              style={styles.secondaryButton}
              disabled={reporting}
            >
              <Text style={styles.secondaryButtonText}>
                {reporting ? 'Opening report...' : 'Report issue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inlineShell: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111111',
  },
  appCard: {
    padding: 24,
  },
  inlineCard: {
    padding: 20,
  },
  widgetCard: {
    padding: 16,
  },
  eyebrow: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  message: {
    color: '#d4d4d8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  metaBlock: {
    marginBottom: 14,
  },
  metaLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    marginTop: 8,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
