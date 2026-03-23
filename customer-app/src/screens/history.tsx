import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  FlatList,
  ListRenderItemInfo,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { StackNavigationProp } from '@react-navigation/stack';
import HistoryCard, { HistoryCardProps } from '../components/HistoryCard';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import { useHistory } from '../hooks/useHistory';
import { HistoryRecord } from '../services/historyApi';

type RootStackParamList = {
  History: undefined;
  Home: undefined;
};

type HistoryItem = HistoryCardProps & { id: string };

const formatTime = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

const transformHistoryRecord = (record: HistoryRecord): HistoryItem => {
  const pickupTime = formatTime(record.pickup.pickupTime);

  // parkAt is a location string, not a timestamp.
  // We use updatedAt as a proxy for the parking time for completed/in-progress requests.
  const parkTime = record.pickup.parkAt
    ? formatTime(record.updatedAt)
    : 'Pending';

  const dropTime = record.drop
    ? formatTime(record.drop.dropTime)
    : 'Pending';
  const date = formatDate(record.pickup.pickupTime);

  return {
    id: record.id,
    vehiclePlate: record.vehicle.vehicleNumber,
    date,
    parkedAt: record.pickup.parkAt || 'Unknown',
    droppedAt: record.drop?.dropLocation || 'Pending',
    pickupTime,
    parkTime,
    dropTime,
    pickupValet: record.pickup.pickupBy.fullName,
    dropOffValet: record.drop?.droppedBy.fullName || 'Pending',
  };
};

const History: React.FC = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('History');
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { data, loading, error: historyError, refetch } = useHistory();

  if (error) return ErrorBoundaryUI;

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const historyData: HistoryItem[] = data.map(transformHistoryRecord);

  const renderEmptyState = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color="#5E5CD5"
            style={{ marginTop: hp('5%') }}
          />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      );
    }

    if (historyError) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {historyError}</Text>
          <Pressable
            onPress={() => refetch()}
            style={styles.retryButton}
            android_ripple={{ color: '#00000010' }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No history found</Text>
      </View>
    );
  }, [loading, historyError, refetch]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<HistoryItem>) => {
      return (
        <HistoryCard
          {...item}
          onPress={(id: string) => {
            console.log('Card pressed', id);
          }}
        />
      );
    },
    []
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  const keyExtractor = useCallback((item: HistoryItem) => item.id, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      <View style={styles.container}>

        {/* ---------------- HEADER FIXED (baseline aligned) ---------------- */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={styles.backButton}
            android_ripple={{ color: '#00000010', radius: 22 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>

          <Text style={styles.title}>History</Text>
        </View>
        {/* ------------------------------------------------ */}

        <FlatList
          data={historyData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={11}
          removeClippedSubviews={true}
          nestedScrollEnabled={Platform.OS === 'android'}
        />
      </View>
    </SafeAreaView>
  );
};

export default History;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  /* -------------- FIXED HEADER (baseline aligned) -------------- */
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',        // <-- ensure baseline alignment
    alignContent: 'center',
    paddingHorizontal: wp('5.5%'),
    height: hp('7%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: wp('0.2%'),
    borderBottomColor: '#E5E5EA',
  },

  backButton: {
    width: wp('5%'),                 // Smaller width for tight alignment
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: hp('0.6%'),         // nudge so arrow baseline matches text
    paddingLeft: wp('1%'),
  },

  backArrow: {
    fontSize: hp('4%'),
    fontWeight: '700',
    color: '#000',
    includeFontPadding: false,
    paddingTop: Platform.OS === 'ios' ? hp('0.2%') : hp(0),
    lineHeight: Math.round(hp('3.6%')), // match lineHeight with title
  },

  title: {
    marginLeft: wp('1%'),           // Very small gap from arrow
    fontSize: hp('2.4%'),
    fontWeight: '700',
    color: '#000',
    textAlign: 'left',
    includeFontPadding: false,
    lineHeight: Math.round(hp('3.6%')), // same as backArrow for baseline match
  },

  listContent: {
    paddingTop: hp('2%'),
    paddingBottom: hp('3%'),
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
  },

  loadingText: {
    marginTop: hp('2%'),
    fontSize: hp('1.8%'),
    color: '#666',
    fontWeight: '500',
  },

  emptyText: {
    fontSize: hp('2%'),
    color: '#999',
    fontWeight: '500',
  },

  errorText: {
    fontSize: hp('1.8%'),
    color: '#E74C3C',
    fontWeight: '500',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },

  retryButton: {
    marginTop: hp('2%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    backgroundColor: '#5E5CD5',
    borderRadius: wp('2%'),
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: hp('1.6%'),
    fontWeight: '600',
  },
});
