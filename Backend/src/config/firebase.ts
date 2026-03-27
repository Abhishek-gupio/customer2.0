import * as admin from 'firebase-admin';
import { logger } from './logger';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : undefined;

let isInitialized = false;

if (serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
    });
    isInitialized = true;
    logger.info("Firebase Admin initialized successfully.");
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase Admin");
  }
} else {
  logger.warn("Firebase credentials missing (FIREBASE_SERVICE_ACCOUNT_JSON). Push notifications via FCM will be disabled.");
}

export const getMessaging = () => {
  if (!isInitialized) return null;
  return admin.messaging();
};
