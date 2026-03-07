import React from 'react';
import { createNativeStackNavigator } from '../lib/react-navigation-native-stack';
import { WarrantyStatus } from '../screens/ServiceAndWarrenty/WarrantyStatus';
import ServiceHistory from '../screens/ServiceAndWarrenty/ServiceHistory';

const Stack = createNativeStackNavigator();

export function ServiceNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="WarrantyStatus" component={WarrantyStatus} />
            <Stack.Screen name="ServiceHistory" component={ServiceHistory} />
        </Stack.Navigator>
    );
}
