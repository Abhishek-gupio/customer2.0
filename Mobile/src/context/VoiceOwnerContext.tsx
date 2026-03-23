import React, { createContext, useCallback, useState } from 'react';

/** Who is using the device microphone. Only one owner at a time. */
export type VoiceOwner = 'heyGupio' | 'addExpense' | 'chat' | null;

type VoiceOwnerContextValue = {
  voiceOwner: VoiceOwner;
  setVoiceOwner: (owner: VoiceOwner) => void;
  /** True if Hey Gupio overlay is allowed to listen (no one else has the mic). */
  heyGupioCanListen: boolean;
};

const defaultValue: VoiceOwnerContextValue = {
  voiceOwner: null,
  setVoiceOwner: () => {},
  heyGupioCanListen: true,
};

export const VoiceOwnerContext = createContext<VoiceOwnerContextValue>(defaultValue);

export function VoiceOwnerProvider({ children }: { children: React.ReactNode }) {
  const [voiceOwner, setVoiceOwnerState] = useState<VoiceOwner>(null);
  const setVoiceOwner = useCallback((owner: VoiceOwner) => {
    setVoiceOwnerState(owner);
  }, []);
  const heyGupioCanListen = voiceOwner === null || voiceOwner === 'heyGupio';

  return (
    <VoiceOwnerContext.Provider
      value={{
        voiceOwner,
        setVoiceOwner,
        heyGupioCanListen,
      }}
    >
      {children}
    </VoiceOwnerContext.Provider>
  );
}
