import { logger } from "./logger";
import {
  loadFirebaseAdmin,
  type FirebaseMessaging,
} from "../utils/firebaseAdmin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : undefined;

const admin = loadFirebaseAdmin();
let isInitialized = Boolean(admin?.apps.length);

if (!admin) {
  logger.warn(
    "firebase-admin package not installed. Push notifications via FCM will be disabled.",
  );
} else if (!isInitialized && (serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  try {
    admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
    });
    isInitialized = true;
    logger.info("Firebase Admin initialized successfully.");
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase Admin");
  }
} else if (!isInitialized) {
  logger.warn("Firebase credentials missing (FIREBASE_SERVICE_ACCOUNT_JSON). Push notifications via FCM will be disabled.");
}

export const getMessaging = (): FirebaseMessaging | null => {
  if (!admin || !isInitialized) return null;
  return admin.messaging();
};
