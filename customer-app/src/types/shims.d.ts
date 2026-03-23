declare module 'react-native-maps' {
  import * as React from 'react';
  
  export const PROVIDER_DEFAULT: any;
  export const PROVIDER_GOOGLE: any;
  
  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }
  
  export interface MapViewProps {
    style?: any;
    provider?: any;
    initialRegion?: Region;
    region?: Region;
    mapType?: string;
    customMapStyle?: any[];
    children?: React.ReactNode;
    onMapReady?: () => void;
    onError?: (error: any) => void;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsCompass?: boolean;
    zoomEnabled?: boolean;
    scrollEnabled?: boolean;
    rotateEnabled?: boolean;
    pitchEnabled?: boolean;
  }
  
  export interface MarkerProps {
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
    anchor?: { x: number; y: number };
    image?: any;
    pinColor?: string;
    children?: React.ReactNode;
  }
  
  export interface PolylineProps {
    coordinates: Array<{ latitude: number; longitude: number }>;
    strokeColor?: string;
    strokeWidth?: number;
    lineCap?: 'round' | 'butt' | 'square';
    lineJoin?: 'round' | 'miter' | 'bevel';
  }
  
  export default class MapView extends React.Component<MapViewProps> {
    animateToRegion(region: Region, duration?: number): void;
    animateToCoordinate(coordinate: { latitude: number; longitude: number }, duration?: number): void;
  }
  
  export class Marker extends React.Component<MarkerProps> {}
  export class Polyline extends React.Component<PolylineProps> {}
}

declare module 'socket.io-client' {
  const io: any;
  export default io;
}


