import { Platform } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import TelematicsSDK from 'react-native-telematics';

export const telematicsService = {
    /**
     * Request necessary native device permissions
     */
    async requestPermissions() {
        try {
            if (Platform.OS === 'android') {
                const fineLoc = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
                const bgLoc = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
                const activity = await request(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);

                return fineLoc === RESULTS.GRANTED || bgLoc === RESULTS.GRANTED;
            } else if (Platform.OS === 'ios') {
                const motion = await request(PERMISSIONS.IOS.MOTION);
                const locationWhenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
                const locationAlways = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);

                return locationWhenInUse === RESULTS.GRANTED || locationAlways === RESULTS.GRANTED;
            }
            return false;
        } catch (error) {
            console.error('Error requesting telematics permissions:', error);
            return false;
        }
    },

    /**
     * Initialize Damoov Telematics SDK
     * @param deviceToken The generated device token from backend
     */
    async initSDK(deviceToken: string) {
        if (!deviceToken) {
            console.error("Cannot initialize Telematics SDK: Missing device token");
            return;
        }

        try {
            TelematicsSDK.initialize();
            await TelematicsSDK.setDeviceId(deviceToken);
            await TelematicsSDK.startManualPersistentTracking();
            console.log('Successfully initialized Damoov Telematics SDK');
        } catch (error) {
            console.error('Error initializing Telematics SDK:', error);
        }
    }
};
