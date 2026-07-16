declare module 'react-native-image-picker' {
  export interface Asset {
    uri: string;
    fileName?: string;
    type?: string;
    fileSize?: number;
  }
  export interface ImagePickerResponse {
    didCancel?: boolean;
    errorCode?: string;
    errorMessage?: string;
    assets?: Asset[];
  }
  export function launchCamera(
    options?: { mediaType?: string; quality?: number },
  ): Promise<ImagePickerResponse>;
  export function launchImageLibrary(
    options?: { mediaType?: string; quality?: number; selectionLimit?: number },
  ): Promise<ImagePickerResponse>;
}

