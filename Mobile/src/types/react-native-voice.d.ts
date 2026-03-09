declare module '@react-native-voice/voice' {
    export interface VoiceModule {
        onSpeechStart?: (e: any) => void;
        onSpeechEnd?: (e: any) => void;
        onSpeechResults?: (e: any) => void;
        start: (locale: string) => Promise<void>;
        stop: () => Promise<void>;
        destroy: () => Promise<void>;
        removeAllListeners: () => void;
        isAvailable: () => Promise<boolean>;
    }
    const Voice: VoiceModule;
    export default Voice;
}
