import { StyleSheet, Text, View,Image, Pressable,TouchableOpacity,Alert,ScrollView,
    Linking
} from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme/colors'
import { fontWeights as FW } from '../theme/Fontsize'
import Ionicons from "react-native-vector-icons/Ionicons";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useNavigation } from '../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../navigation/types';
// import {  } from 'react-native-gesture-handler'
const sendAutoSMS = async () => {
  const number = '9739224982';
  const message = encodeURIComponent('SOS! I need help. Please reach me immediately.');
  await Linking.openURL(`sms:${number}?body=${message}`);
};



const SOSButton = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const handleSOS = () => {
        Alert.alert("Emergency triggered")
        sendAutoSMS().catch((error) => {
          console.log('Failed to open SMS app:', error);
        });
    };
    
    const makeCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
    };


    type ActionButtonProps = {
      icon: string;
      label: string;
      color: string;
    };

    const ActionButton = ({ icon, label, color }: ActionButtonProps) => (
  <TouchableOpacity style={styles.action}>
    <View style={[styles.circle, { backgroundColor: color }]}>
      <Ionicons name={icon} size={28} color="#111" />
    </View>
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' , gap:wp(2)}}>
            <Image
                source={{uri:"https://m.media-amazon.com/images/I/41EjjV414pL.jpg"}}
                style={{ width: 40, height: 40 , borderRadius:50 }}
            />
            <View>
                <Text style={styles.title}>Hello, Shree!</Text>
                <Text style={styles.subTitle}>Your safety is our priority.</Text>
            </View>
        </View> 

        <Pressable onPress={()=>navigation.navigate("Alerts")}>
            <Ionicons name="notifications-outline" size={24} color="#fff" /> 
        </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.actions}>
            <Text style={styles.ActionsTitle}>Quick Actions</Text>

            <View style={styles.row}>
                <ActionButton
                icon="location-outline"
                label={"Share\nLocation"}
                color="#22c55e"
                />

                <ActionButton
                icon="people-outline"
                label={"Alert\nFamily"}
                color="#f97316"
                />

                <ActionButton
                icon="call-outline"
                label={"Call\nPolice"}
                color="#3b82f6"
                />
            </View>
        </View>
    <View style={styles.SoScontainer}>
    <TouchableOpacity
        style={styles.sosButton}
        onLongPress={handleSOS}
        delayLongPress={1500}
      >
        <Ionicons name="alert-circle-outline" size={40} color="#000" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Hint: Long press to send an emergency alert!
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusText}>Safety Status:</Text>
        <Text style={styles.active}>Active *</Text>
      </View>
    </View>
<View style={styles.safeZoneContainer}>
  <Text style={styles.safeZoneTitle}>Nearby Safe Zones</Text>

  <TouchableOpacity
    style={styles.safeZoneItem}
    onPress={() => makeCall("100")}
  >
    <Ionicons name="shield-checkmark-outline" size={24} color="#3b82f6" />
    <Text style={styles.safeZoneText}>Police Station</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.safeZoneItem}
    onPress={() => makeCall("102")}
  >
    <Ionicons name="medkit-outline" size={24} color="#ef4444" />
    <Text style={styles.safeZoneText}>Hospital / Ambulance</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.safeZoneItem}
    onPress={() => makeCall("101")}
  >
    <Ionicons name="flame-outline" size={24} color="#f97316" />
    <Text style={styles.safeZoneText}>Fire Station</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.safeZoneItem}
    onPress={() => makeCall("112")}
  >
    <Ionicons name="call-outline" size={24} color="#22c55e" />
    <Text style={styles.safeZoneText}>National Emergency</Text>
  </TouchableOpacity>
</View>
    </ScrollView>
    </SafeAreaView>
  )
}

export default SOSButton

const styles = StyleSheet.create({
    container:{
        backgroundColor:colors.Background,
        flex:1,
    },
    header:{
        flexDirection:"row",
        justifyContent:"space-between",
        alignItems:"center",
        paddingHorizontal:wp(4.5),
        paddingVertical:hp(2),
    },
    title:{
        color:colors.Primary,
        fontWeight:FW.header,
    },
    subTitle:{
        color:colors.Secondary,
        fontSize:wp(3),
    },
    actions:{
        backgroundColor:colors.Dark,
        paddingHorizontal:wp(5),
        paddingVertical:hp(2),
        marginHorizontal:wp(5),
        borderRadius:wp(5),
        marginVertical:hp(2.5),
    },
    row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  action: {
    alignItems: "center",
    width: 90,
  },
  circle: {
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
    label: {
    color: "#ccc",
    textAlign: "center",
    fontSize: 13,
  },
  ActionsTitle:{
    fontSize:wp(5),
    fontWeight:FW.header,
    color:colors.Primary,
    marginBottom:hp(2),
  },
    sosButton: {
    width: 180,
    height: 180,
    borderRadius: 100,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#ff3b30",
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },

  sosText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#000",
    marginTop: 5,
  },

  hint: {
    marginTop: 20,
    color: "#aaa",
  },

  statusCard: {
    marginTop: 40,
    backgroundColor: colors.Dark,
    padding: wp(4.5),
    width: "90%",
    borderRadius: wp(5),
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statusText: {
    color: "#ccc",
  },

  active: {
    color: "#22c55e",
    fontWeight: "600",
  },
  SoScontainer:{
    justifyContent:"center",
    alignItems:"center",
  },
  safeZoneContainer: {
  backgroundColor: colors.Dark,
  marginHorizontal: wp(5),
  marginTop: hp(2),
  padding: wp(5),
  borderRadius: wp(5),
},

safeZoneTitle: {
  fontSize: wp(5),
  color: colors.Primary,
  fontWeight: FW.header,
  marginBottom: hp(2),
},

safeZoneItem: {
  flexDirection: "row",
  alignItems: "center",
  gap: wp(3),
  paddingVertical: hp(1.5),
  borderWidth:wp(0.1),
  borderColor:colors.Border,
  borderRadius: wp(5),
  marginBottom: hp(1),
  paddingHorizontal: wp(4),
},

safeZoneText: {
  color: "#ccc",
  fontSize: wp(3.8),
},
})

