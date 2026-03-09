import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Modal, SafeAreaView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

interface AssistanceDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    currentLat: number | null;
    currentLon: number | null;
}

export const AssistanceDrawer: React.FC<AssistanceDrawerProps> = ({ isVisible, onClose, currentLat, currentLon }) => {

    const handleCallSOS = () => {
        Linking.openURL('tel:911'); // Or substitute with actual operations hotline
    };

    const handleFindFuel = () => {
        if (!currentLat || !currentLon) return;
        const url = Platform.select({
            ios: `maps://?q=gas+station&near=${currentLat},${currentLon}`,
            android: `geo:${currentLat},${currentLon}?q=gas+station`,
        });
        if (url) Linking.openURL(url);
    };

    const handleFindService = () => {
        if (!currentLat || !currentLon) return;
        const url = Platform.select({
            ios: `maps://?q=auto+repair&near=${currentLat},${currentLon}`,
            android: `geo:${currentLat},${currentLon}?q=auto+repair`,
        });
        if (url) Linking.openURL(url);
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdropButton} onPress={onClose} />

                <SafeAreaView style={styles.drawerContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Roadside Assistance</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Icon name="times" size={wp(5)} color="#aaa" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.mapInfo}>
                        <Icon name="map-marker-alt" size={wp(4)} color="#4ade80" />
                        <Text style={styles.coordinateText}>
                            {currentLat && currentLon
                                ? `Current GPS: ${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`
                                : `Acquiring Location...`}
                        </Text>
                    </View>

                    <TouchableOpacity style={[styles.actionButton, styles.sosButton]} onPress={handleCallSOS}>
                        <Icon name="phone-alt" size={wp(5)} color="#fff" style={styles.iconAlt} />
                        <Text style={styles.sosText}>Call SOS Hotline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleFindFuel}>
                        <Icon name="gas-pump" size={wp(5)} color="#fff" style={styles.iconAlt} />
                        <Text style={styles.actionText}>Find Nearby Fuel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleFindService}>
                        <Icon name="tools" size={wp(5)} color="#fff" style={styles.iconAlt} />
                        <Text style={styles.actionText}>Find Nearest Service Center</Text>
                    </TouchableOpacity>

                    <View style={styles.padBottom} />
                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    backdropButton: {
        flex: 1,
        width: '100%'
    },
    drawerContainer: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: wp(6),
        borderTopRightRadius: wp(6),
        paddingHorizontal: wp(6),
        paddingTop: hp(3),
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#333'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2)
    },
    title: {
        color: '#fff',
        fontSize: wp(5.5),
        fontWeight: 'bold',
    },
    closeButton: {
        padding: wp(2)
    },
    mapInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        padding: wp(3),
        borderRadius: wp(2),
        marginBottom: hp(3)
    },
    coordinateText: {
        color: '#4ade80',
        marginLeft: wp(2),
        fontSize: wp(3.5),
        fontWeight: 'bold'
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        padding: hp(2),
        borderRadius: wp(3),
        marginBottom: hp(1.5)
    },
    sosButton: {
        backgroundColor: '#ef4444'
    },
    iconAlt: {
        width: wp(8),
        textAlign: 'center'
    },
    actionText: {
        color: '#fff',
        fontSize: wp(4.5),
        fontWeight: '600',
        marginLeft: wp(3)
    },
    sosText: {
        color: '#fff',
        fontSize: wp(4.5),
        fontWeight: '700',
        marginLeft: wp(3)
    },
    padBottom: {
        height: hp(4)
    }
});
