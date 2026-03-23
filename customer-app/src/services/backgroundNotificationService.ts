import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

let backgroundHandlersRegistered = false;

/**
 * Registers background notification handlers after app is fully loaded
 * This prevents startup issues while still providing app-killed notification support
 */
export function registerBackgroundNotificationHandlers(): void {
  if (backgroundHandlersRegistered) {
    console.log('🔔 [CustomerApp] Background notification handlers already registered');
    return;
  }

  try {
    console.log('🔔 [CustomerApp] Registering background notification handlers...');

    // FCM background handler for app-killed scenarios
    messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('🔔 [CustomerApp] Background message received (delayed handler):', remoteMessage);
      
      try {
        const title = (remoteMessage?.notification && remoteMessage.notification.title) || 
                     (typeof remoteMessage?.data?.title === 'string' ? remoteMessage.data.title : 'Customer Notification');
        const body = (remoteMessage?.notification && remoteMessage.notification.body) || 
                    (typeof remoteMessage?.data?.body === 'string' ? remoteMessage.data.body : 'You have a new notification');
        
        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: 'customer_default',
            smallIcon: 'ic_launcher',
            pressAction: { 
              id: 'customer_default', 
              launchActivity: 'default' 
            },
          },
          data: {
            ...(remoteMessage?.data || {}),
            id: `customer_bg_notification_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
          },
        });
        
        console.log('🔔 [CustomerApp] Background notification displayed successfully');
      } catch (error) {
        console.log('❌ [CustomerApp] Error displaying background notification:', error);
      }
    });

    // Notifee background event handler for click events
    notifee.onBackgroundEvent(async (event) => {
      console.log('🔔 [CustomerApp] Background notification clicked:', event);
      // The actual navigation will be handled by the main app's notification handlers
      // when the app becomes active
    });

    backgroundHandlersRegistered = true;
    console.log('✅ [CustomerApp] Background notification handlers registered successfully');
    
  } catch (error) {
    console.log('❌ [CustomerApp] Error registering background notification handlers:', error);
  }
}

/**
 * Checks if background handlers are registered
 */
export function areBackgroundHandlersRegistered(): boolean {
  return backgroundHandlersRegistered;
}
