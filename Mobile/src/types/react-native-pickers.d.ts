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
    options?: { mediaType?: string; quality?: number },
  ): Promise<ImagePickerResponse>;
}

declare module 'react-native-document-picker' {
  export interface DocumentPickerResponse {
    uri: string;
    name: string | null;
    type: string | null;
    size: number | null;
    fileCopyUri?: string | null;
  }
  export const types: {
    pdf: string;
    images: string;
    allFiles: string;
  };
  export function pick(options?: {
    type?: string[];
    allowMultiSelection?: boolean;
  }): Promise<DocumentPickerResponse[]>;
}
