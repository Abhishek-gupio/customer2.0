export type FirebaseMulticastMessage = {
  tokens: string[];
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority?: "high" | "normal";
    notification?: {
      sound?: string;
      channelId?: string;
    };
  };
};

export type FirebaseSendResponse = {
  success: boolean;
  error?: unknown;
};

export type FirebaseBatchResponse = {
  successCount: number;
  failureCount: number;
  responses: FirebaseSendResponse[];
};

export type FirebaseMessaging = {
  sendEachForMulticast(
    message: FirebaseMulticastMessage,
  ): Promise<FirebaseBatchResponse>;
};

type FirebaseCredentialFactory = {
  cert(serviceAccount: Record<string, unknown>): unknown;
  applicationDefault(): unknown;
};

export type FirebaseAdminModule = {
  apps: unknown[];
  credential: FirebaseCredentialFactory;
  initializeApp(options: { credential: unknown }): unknown;
  messaging(): FirebaseMessaging;
};

let cachedFirebaseAdmin: FirebaseAdminModule | null | undefined;

export const loadFirebaseAdmin = (): FirebaseAdminModule | null => {
  if (cachedFirebaseAdmin !== undefined) {
    return cachedFirebaseAdmin;
  }

  try {
    cachedFirebaseAdmin = require("firebase-admin") as FirebaseAdminModule;
  } catch {
    cachedFirebaseAdmin = null;
  }

  return cachedFirebaseAdmin;
};
