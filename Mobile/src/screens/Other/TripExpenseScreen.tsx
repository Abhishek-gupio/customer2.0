import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useNavigation } from '../../lib/react-navigation-native';
import { tripExpenseService, type TripRoute, type TripExpenseResult } from '../../services/tripExpenseService';
import { placesService, type SearchSuggestion } from '../../services/placesService';

// ─── Colors (matching app dark theme) ────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  card: '#111111',
  cardBorder: 'rgba(255,255,255,0.08)',
  accent: '#FFBF00',
  accentLight: '#FFD700',
  accentBg: 'rgba(255,191,0,0.1)',
  text: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#555555',
  green: '#22c55e',
  greenBg: 'rgba(34,197,94,0.12)',
  orange: '#f59e0b',
  orangeBg: 'rgba(245,158,11,0.12)',
  red: '#ef4444',
  inputBg: '#1a1a1a',
  inputBorder: '#222222',
  divider: '#1e1e1e',
};

export default function TripExpenseScreen() {
  const navigation = useNavigation();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  
  const [fromSuggestions, setFromSuggestions] = useState<SearchSuggestion[]>([]);
  const [toSuggestions, setToSuggestions] = useState<SearchSuggestion[]>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TripExpenseResult | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  const searchTimeout = useRef<any>(null);

  const handleSearch = (text: string, type: 'from' | 'to') => {
    if (type === 'from') {
      setFrom(text);
      if (text.length < 3) {
        setFromSuggestions([]);
        setShowFromSuggestions(false);
        return;
      }
    } else {
      setTo(text);
      if (text.length < 3) {
        setToSuggestions([]);
        setShowToSuggestions(false);
        return;
      }
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      const suggestions = await placesService.search(text);
      if (type === 'from') {
        setFromSuggestions(suggestions);
        setShowFromSuggestions(suggestions.length > 0);
      } else {
        setToSuggestions(suggestions);
        setShowToSuggestions(suggestions.length > 0);
      }
    }, 400);
  };

  const selectSuggestion = (suggestion: SearchSuggestion, type: 'from' | 'to') => {
    if (type === 'from') {
      setFrom(suggestion.description);
      setShowFromSuggestions(false);
    } else {
      setTo(suggestion.description);
      setShowToSuggestions(false);
    }
  };

  const handleCalculate = useCallback(async () => {
    if (!from.trim() || !to.trim()) {
      setError('Please enter both origin and destination');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await tripExpenseService.calculate({
        from: from.trim(),
        to: to.trim(),
      });
      setResult(data);
      setSelectedRouteIdx(0);
    } catch (err: any) {
      setError(err?.message || 'Failed to calculate trip expenses');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const selectedRoute: TripRoute | null =
    result?.routes?.[selectedRouteIdx] ?? null;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trip Expense Calculator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Input Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Plan Your Trip</Text>
          <Text style={s.cardSubtitle}>
            Get exact toll charges, fuel cost & total expense
          </Text>

          {/* From */}
          <View style={s.inputGroup}>
            <View style={s.inputIcon}>
              <View style={[s.dot, { backgroundColor: C.green }]} />
            </View>
            <TextInput
              style={s.input}
              placeholder="From — e.g. Mysuru, Karnataka"
              placeholderTextColor={C.textMuted}
              value={from}
              onChangeText={(t: string) => handleSearch(t, 'from')}
              onFocus={() => fromSuggestions.length > 0 && setShowFromSuggestions(true)}
              returnKeyType="next"
            />
          </View>

          {showFromSuggestions && (
            <View style={s.suggestionsList}>
              {fromSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.placeId}
                  style={s.suggestionItem}
                  onPress={() => selectSuggestion(item, 'from')}
                >
                  <Text style={s.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                  <Text style={s.suggestionSub} numberOfLines={1}>{item.secondaryText}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Connector line */}
          <View style={s.connector}>
            <View style={s.connectorLine} />
          </View>

          {/* To */}
          <View style={s.inputGroup}>
            <View style={s.inputIcon}>
              <View style={[s.dot, { backgroundColor: C.red }]} />
            </View>
            <TextInput
              style={s.input}
              placeholder="To — e.g. Kochi, Kerala"
              placeholderTextColor={C.textMuted}
              value={to}
              onChangeText={(t: string) => handleSearch(t, 'to')}
              onFocus={() => toSuggestions.length > 0 && setShowToSuggestions(true)}
              returnKeyType="done"
              onSubmitEditing={handleCalculate}
            />
          </View>

          {showToSuggestions && (
            <View style={s.suggestionsList}>
              {toSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.placeId}
                  style={s.suggestionItem}
                  onPress={() => selectSuggestion(item, 'to')}
                >
                  <Text style={s.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                  <Text style={s.suggestionSub} numberOfLines={1}>{item.secondaryText}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Calculate Button */}
          <TouchableOpacity
            style={[s.calcBtn, loading && s.calcBtnDisabled]}
            onPress={handleCalculate}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.calcBtnText}>Calculate Expenses</Text>
            )}
          </TouchableOpacity>

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Results */}
        {result && result.routes.length > 0 && (
          <>
            {/* Route Tabs */}
            {result.routes.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.routeTabs}
                contentContainerStyle={s.routeTabsContent}
              >
                {result.routes.map((route, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      s.routeTab,
                      idx === selectedRouteIdx && s.routeTabActive,
                    ]}
                    onPress={() => setSelectedRouteIdx(idx)}
                  >
                    <Text
                      style={[
                        s.routeTabText,
                        idx === selectedRouteIdx && s.routeTabTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {route.routeName || `Route ${idx + 1}`}
                    </Text>
                    {result.cheapestRoute === route && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>Cheapest</Text>
                      </View>
                    )}
                    {result.fastestRoute === route &&
                      result.cheapestRoute !== route && (
                        <View style={[s.badge, { backgroundColor: C.orangeBg }]}>
                          <Text style={[s.badgeText, { color: C.orange }]}>
                            Fastest
                          </Text>
                        </View>
                      )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedRoute && (
              <>
                {/* Total Cost Hero */}
                <View style={s.heroCard}>
                  <Text style={s.heroLabel}>Total Trip Cost</Text>
                  <Text style={s.heroAmount}>
                    ₹{selectedRoute.costs.total.toLocaleString('en-IN')}
                  </Text>
                  <Text style={s.heroSub}>
                    {selectedRoute.distance.text} • {selectedRoute.duration.text}
                  </Text>
                </View>

                {/* Cost Breakdown */}
                <View style={s.card}>
                  <Text style={s.sectionTitle}>Cost Breakdown</Text>

                  <CostRow
                    icon="⛽"
                    label="Fuel Cost"
                    amount={selectedRoute.costs.fuel}
                    sub={`${selectedRoute.fuelUsed.liters}L @ ₹${selectedRoute.fuelPriceUsed.price}/L (${selectedRoute.fuelPriceUsed.type})`}
                    color={C.orange}
                    bgColor={C.orangeBg}
                  />
                  <View style={s.divider} />
                  <CostRow
                    icon="🛣️"
                    label="Toll (FASTag)"
                    amount={selectedRoute.costs.tollFastag}
                    sub={`${selectedRoute.tolls.length} toll plaza${selectedRoute.tolls.length !== 1 ? 's' : ''}`}
                    color={C.accent}
                    bgColor={C.accentBg}
                  />
                  {selectedRoute.costs.tollCash > 0 && (
                    <>
                      <View style={s.divider} />
                      <CostRow
                        icon="💵"
                        label="Toll (Cash)"
                        amount={selectedRoute.costs.tollCash}
                        sub="Without FASTag"
                        color={C.textSecondary}
                        bgColor="rgba(136,136,136,0.1)"
                      />
                    </>
                  )}
                </View>

                {/* Trip Details */}
                <View style={s.card}>
                  <Text style={s.sectionTitle}>Trip Details</Text>
                  <View style={s.detailsGrid}>
                    <DetailItem label="Distance" value={selectedRoute.distance.text} />
                    <DetailItem label="Duration" value={selectedRoute.duration.text} />
                    <DetailItem
                      label="Fuel Efficiency"
                      value={`${selectedRoute.fuelEfficiency.city}/${selectedRoute.fuelEfficiency.hwy} ${selectedRoute.fuelEfficiency.unit}`}
                    />
                    <DetailItem
                      label="Vehicle Type"
                      value={result.vehicleType}
                    />
                  </View>
                </View>

                {/* Toll Plazas */}
                {selectedRoute.tolls.length > 0 && (
                  <View style={s.card}>
                    <Text style={s.sectionTitle}>
                      Toll Plazas ({selectedRoute.tolls.length})
                    </Text>
                    {selectedRoute.tolls.map((toll, idx) => (
                      <View key={idx}>
                        {idx > 0 && <View style={s.divider} />}
                        <View style={s.tollRow}>
                          <View style={s.tollInfo}>
                            <Text style={s.tollName} numberOfLines={1}>
                              {toll.name}
                            </Text>
                            <Text style={s.tollRoad}>
                              {toll.road}
                              {toll.state ? ` • ${toll.state}` : ''}
                            </Text>
                          </View>
                          <View style={s.tollCosts}>
                            <Text style={s.tollFastag}>
                              ₹{toll.tagCost}
                            </Text>
                            {toll.cashCost > 0 && toll.cashCost !== toll.tagCost && (
                              <Text style={s.tollCash}>
                                Cash: ₹{toll.cashCost}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* No results */}
        {result && result.routes.length === 0 && !error && (
          <View style={s.card}>
            <Text style={[s.cardTitle, { textAlign: 'center' }]}>
              No routes found
            </Text>
            <Text style={[s.cardSubtitle, { textAlign: 'center' }]}>
              Try different locations or check the spelling
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function CostRow({
  icon,
  label,
  amount,
  sub,
  color,
  bgColor,
}: {
  icon: string;
  label: string;
  amount: number;
  sub: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={s.costRow}>
      <View style={[s.costIcon, { backgroundColor: bgColor }]}>
        <Text style={{ fontSize: wp(4.5) }}>{icon}</Text>
      </View>
      <View style={s.costInfo}>
        <Text style={s.costLabel}>{label}</Text>
        <Text style={s.costSub}>{sub}</Text>
      </View>
      <Text style={[s.costAmount, { color }]}>
        ₹{amount.toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailItem}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingTop: hp(6),
    paddingBottom: hp(1.5),
    backgroundColor: C.bg,
  },
  backBtn: { width: wp(10), height: wp(10), justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: wp(6), color: C.text },
  headerTitle: { fontSize: wp(4.5), fontFamily: 'Outfit-Bold', color: C.text },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: wp(5), paddingTop: hp(1) },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: wp(5),
    marginBottom: hp(2),
  },
  cardTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: C.text, marginBottom: hp(0.5) },
  cardSubtitle: { fontSize: wp(3.5), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginBottom: hp(2.5) },

  // Input
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: wp(3.5),
    height: 54,
  },
  inputIcon: { width: wp(6), alignItems: 'center' },
  dot: { width: wp(2.5), height: wp(2.5), borderRadius: wp(1.25) },
  input: {
    flex: 1,
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
    color: C.text,
    marginLeft: wp(2.5),
    height: '100%',
    padding: 0,
  },

  // Connector
  connector: { alignItems: 'flex-start', paddingLeft: wp(6.2), height: hp(1.5) },
  connectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: C.divider,
  },

  // Calculate Button
  calcBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(2.5),
  },
  calcBtnDisabled: { opacity: 0.6 },
  calcBtnText: { fontSize: wp(4), fontFamily: 'Outfit-Bold', color: '#000' },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    padding: wp(3),
    marginTop: hp(1.5),
  },
  errorText: { fontSize: wp(3.2), fontFamily: 'Outfit-Medium', color: C.red, textAlign: 'center' },

  // Route Tabs
  routeTabs: { marginBottom: hp(2) },
  routeTabsContent: { gap: wp(2) },
  routeTab: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    minWidth: wp(30),
  },
  routeTabActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  routeTabText: { fontSize: wp(3.2), fontFamily: 'Outfit-SemiBold', color: C.textSecondary },
  routeTabTextActive: { color: C.accent },
  badge: {
    backgroundColor: C.greenBg,
    borderRadius: 6,
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    marginTop: hp(0.5),
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: wp(2.5), fontFamily: 'Outfit-Bold', color: C.green },

  // Hero
  heroCard: {
    backgroundColor: C.accent,
    borderRadius: 16,
    padding: wp(6),
    marginBottom: hp(2),
    alignItems: 'center',
  },
  heroLabel: { fontSize: wp(3.5), fontFamily: 'Outfit-Medium', color: 'rgba(0,0,0,0.6)' },
  heroAmount: { fontSize: wp(9), fontFamily: 'Outfit-Bold', color: '#000', marginTop: hp(0.5) },
  heroSub: { fontSize: wp(3.5), fontFamily: 'Outfit-Medium', color: 'rgba(0,0,0,0.5)', marginTop: hp(0.8) },

  // Section
  sectionTitle: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: C.text,
    marginBottom: hp(2),
  },

  // Cost Row
  costRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: hp(0.5) },
  costIcon: {
    width: wp(10),
    height: wp(10),
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  costInfo: { flex: 1, marginLeft: wp(3) },
  costLabel: { fontSize: wp(3.8), fontFamily: 'Outfit-SemiBold', color: C.text },
  costSub: { fontSize: wp(3.2), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginTop: hp(0.3) },
  costAmount: { fontSize: wp(4.2), fontFamily: 'Outfit-Bold' },

  // Divider
  divider: { height: 1, backgroundColor: C.divider, marginVertical: hp(1.5) },

  // Details Grid
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(3) },
  detailItem: {
    width: wp(42.5),
    backgroundColor: C.inputBg,
    borderRadius: 10,
    padding: wp(3),
  },
  detailLabel: { fontSize: wp(2.8), fontFamily: 'Outfit-Bold', color: C.textSecondary, textTransform: 'uppercase' },
  detailValue: { fontSize: wp(3.8), fontFamily: 'Outfit-Bold', color: C.text, marginTop: hp(0.5) },

  // Toll Row
  tollRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: hp(0.5) },
  tollInfo: { flex: 1 },
  tollName: { fontSize: wp(3.5), fontFamily: 'Outfit-SemiBold', color: C.text },
  tollRoad: { fontSize: wp(2.8), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginTop: hp(0.3) },
  tollCosts: { alignItems: 'flex-end', marginLeft: wp(3) },
  tollFastag: { fontSize: wp(3.8), fontFamily: 'Outfit-Bold', color: C.accent },
  tollCash: { fontSize: wp(2.8), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginTop: hp(0.3) },

  // Suggestions
  suggestionsList: {
    backgroundColor: '#161616',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
    zIndex: 100,
  },
  suggestionItem: {
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  suggestionMain: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    color: '#fff',
    marginBottom: hp(0.2),
  },
  suggestionSub: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#888',
  },
});
