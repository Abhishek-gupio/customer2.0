import React from 'react';
import { View, Text, StyleSheet ,TextInput, Button, Pressable} from 'react-native';
import { colors, COLORS } from '../../theme/colors';
import { fontSizes as FS , fontWeights as FW } from '../../theme/Fontsize';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Ionicons from "react-native-vector-icons/Ionicons";
import NotificationCard from '../../components/NotificationItem';
import { FlatList } from 'react-native';
import { useState } from 'react';
import { NotificationItem, notifications } from '../Main/notifiData';

export default function Alerts() {
  const [search, setSearch] = useState('');
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>(notifications);

  const filteredNotifications = notificationsList.filter((item) =>
  item.title.toLowerCase().includes(search.toLowerCase()) ||
  item.description.toLowerCase().includes(search.toLowerCase()) 
);

const removeNotification = (id: string) => {
  setNotificationsList(prev =>
    prev.filter(notification => notification.id !== id)
  );
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notification</Text>
        <Text style={styles.subtitle}>Stay updated with alerts</Text>
        <View style={styles.searchBar}> 
        <Ionicons name="search" size={22} color="white" />
        <TextInput
          placeholder="Search notifications..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBarText}
        />
      </View>
      <View>
        <FlatList
          data={notificationsList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard item={item} onRemove={removeNotification} />
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.Background,
  },
  header: {
    justifyContent: 'space-between',
    gap:hp(1),
    paddingHorizontal:wp(4.5)
  },
  title: {
    fontSize: FS.header,
    fontWeight: FW.header,
    color: colors.Primary,
  },
  subtitle: {
    fontSize:FS.subHeader,
    fontWeight:FW.subHeader,
    color:colors.Secondary,
  },
  searchBar: {
    flexDirection:"row",
    borderColor:colors.Border,
    borderRadius:wp(5),
    borderWidth: wp(0.1),
    paddingHorizontal:wp(5),
    paddingVertical:hp(0.8),
    // marginHorizontal:wp(2.5),
    alignItems:"center",
    gap:wp(2),
  },
  searchBarText: {
    fontSize:wp(4.5),
    color:colors.Primary,
  },
});
