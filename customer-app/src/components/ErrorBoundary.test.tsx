import React from 'react';
import { render } from '@testing-library/react-native';
import ErrorBoundary from './ErrorBoundary';
import { Text } from 'react-native';

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Safe content</Text>
      </ErrorBoundary>,
    );
    expect(getByText('Safe content')).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    // Component that throws
    const ProblemChild = () => {
      throw new Error('Test error');
    };
    const { toJSON } = render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );
    // Fallback is a blank view with backgroundColor #fff
    expect(toJSON()).toMatchObject({
      type: 'View',
      props: {
        style: expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#fff' }),
        ]),
      },
    });
  });
});
