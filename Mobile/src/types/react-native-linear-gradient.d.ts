declare module 'react-native-linear-gradient' {
    import { Component } from 'react';
    import { ViewProps } from 'react-native';

    export interface LinearGradientProps extends ViewProps {
        colors: string[];
        start?: { x: number; y: number };
        end?: { x: number; y: number };
        locations?: number[];
        useAngle?: boolean;
        angleCenter?: { x: number; y: number };
        angle?: number;
    }

    export default class LinearGradient extends Component<LinearGradientProps> { }
}
