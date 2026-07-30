import { StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { COLORS } from '../../components/Vehicles/VehicleUI';
import type { ThemeColors } from '../../theme/ThemeContext';

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionTitle: {
    fontFamily: 'Outfit-Bold',
    color: colors.textPrimary,
    fontSize: wp(5),
  },
  sectionSubtitle: {
    marginTop: hp(0.35),
    color: colors.textSecondary,
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
  },
  timelineScrollContent: {
    paddingRight: wp(5),
  },
  timelineCard: {
    width: wp(74),
    height: Math.max(hp(26.5), 238),
    marginRight: wp(3.5),
    borderRadius: 22,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  timelineCardInner: {
    flex: 1,
    paddingTop: wp(4),
    paddingHorizontal: wp(4),
    paddingBottom: wp(4),
  },
  timelineMainContent: {
    flex: 1,
  },
  timelineCardUrgent: {
    borderColor: 'rgba(95, 158, 160, 0.85)',
  },
  timelineCardGood: {
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  timelineCardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  timelineCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp(1),
  },
  timelineIconWrap: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: wp(2.3),
    paddingVertical: hp(0.35),
    maxWidth: wp(28),
  },
  timelineTopChips: {
    alignItems: 'flex-end',
    maxWidth: wp(28),
  },
  timelineBadgeText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(2.6),
    flexShrink: 1,
  },
  timelineMetaRow: {
    marginBottom: hp(0.55),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: wp(2),
    minHeight: hp(2.2),
  },
  timelineBody: {
    flexGrow: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingBottom: hp(0.8),
  },
  timelineEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(2.8),
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexShrink: 1,
  },
  timelineStagePill: {
    borderRadius: 999,
    paddingHorizontal: wp(1.8),
    paddingVertical: hp(0.4),
    maxWidth: wp(24),
  },
  timelineStageNow: {
    backgroundColor: 'rgba(95, 158, 160, 0.4)',
  },
  timelineStageNext: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  timelineStageLater: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  timelineStageText: {
    color: '#fff',
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(2.5),
  },
  timelineCardTitle: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
    lineHeight: hp(2.55),
    marginBottom: hp(0.4),
    minHeight: hp(2.55) * 2,
    textAlignVertical: 'top',
  },
  timelineDescription: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.05),
    lineHeight: hp(1.8),
    minHeight: hp(1.8) * 2,
    marginBottom: hp(0.2),
    textAlignVertical: 'top',
  },
  timelineActionRow: {
    marginTop: hp(1.4),
    paddingTop: hp(1.1),
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: hp(4.3),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  timelineActionPill: {
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: wp(3.2),
    paddingVertical: hp(0.75),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  timelineActionText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
    marginRight: wp(0.8),
    flexShrink: 1,
    color: '#FFFFFF',
  },
  discoveryPlaceholder: {
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discoveryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
  },
  discoveryPlaceholderText: {
    color: '#888',
    fontSize: wp(3.4),
    fontFamily: 'Outfit-Medium',
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  viewAllText: {
    fontFamily: 'Outfit-Medium',
    color: '#ccc',
    fontSize: wp(3.5),
  },

  /* PREMIUM VEHICLE HEADER */
  headerWrapper: {
    width: '100%',
    height: hp(40),
    backgroundColor: '#0d0f14',
    paddingTop: 0,
  },
  primaryImageWrap: {
    marginTop: 0,
    marginHorizontal: 0,
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  primaryImageFull: {
    width: '100%',
    height: '100%',
  },
  primaryImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Bottom-up scrim for text legibility — handled by LinearGradient
    justifyContent: 'flex-end',
    paddingBottom: hp(3.5),
    paddingHorizontal: wp(5.5),
  },
  bannerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  vehicleBannerContent: {
    flex: 1,
    marginBottom: hp(2),
  },
  // Authentic licence plate badge
  regBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginBottom: hp(1),
    borderWidth: 2,
    borderColor: '#003580',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
  },
  regIndStrip: {
    backgroundColor: '#003580',
    paddingHorizontal: wp(1.5),
    paddingVertical: hp(0.4),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  regFlagEmoji: {
    fontSize: wp(2.8),
    lineHeight: wp(3.2),
  },
  regIndText: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(2),
    letterSpacing: 0.5,
  },
  regBadgeText: {
    fontFamily: 'Outfit-Black',
    color: '#0A0A0A',
    fontSize: wp(4.8),
    letterSpacing: 2.5,
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
  },
  bannerMake: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(8),
    letterSpacing: 0.5,
    lineHeight: wp(8.5),
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bannerModel: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(8),
    letterSpacing: 0.5,
    lineHeight: wp(8.5),
    marginBottom: hp(1.5),
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  // Inline health score
  inlineHealth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    marginTop: hp(1.2),
  },
  inlineScore: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(11),
    lineHeight: wp(12),
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  inlineScoreUnit: {
    fontSize: wp(5),
    opacity: 0.5,
  },
  inlineRight: {
    gap: hp(0.6),
    justifyContent: 'center',
  },
  inlineStatusPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.4),
  },
  inlineStatusText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(3),
    letterSpacing: 1,
  },
  inlineSubLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.3)',
    fontSize: wp(2.2),
    letterSpacing: 1.5,
  },
  // Service due chip (right side)
  serviceDueChip: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.2),
    borderRadius: 14,
    marginBottom: hp(2),
    marginLeft: wp(3),
  },
  serviceDueLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.45)',
    fontSize: wp(2.5),
    letterSpacing: 1.5,
  },
  serviceDueValue: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(4),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // legacy / other slides
  headerFooterOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerNumberPlate: {
    fontFamily: 'Outfit-Black',
    color: '#fff',
    fontSize: wp(6),
    letterSpacing: 2,
  },
  headerCarModel: {
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    fontSize: wp(4),
  },
  healthPillRow: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthPillText: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(5),
  },
  healthPillLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp(2.8),
    letterSpacing: 1.5,
  },
  footerItem: { justifyContent: 'center' },
  footerLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.6)',
    fontSize: wp(2.5),
    letterSpacing: 1,
  },
  footerValue: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(4.5),
    marginTop: hp(0.2),
  },
  healthSection: { marginTop: hp(1.5) },
  healthText: { fontFamily: 'Outfit-Black', color: '#fff', fontSize: wp(4.5) },
  healthLabel: { color: '#4ade80', fontSize: wp(3.5) },
  headerCarImage: {
    width: wp(40),
    height: hp(16),
    transform: [{ scale: 1.1 }, { translateX: wp(5) }],
  },
  headerOverlay: {
    position: 'absolute',
    top: hp(1),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    zIndex: 10,
  },
  overlayIconButton: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sosOverlayButton: {
    height: hp(4),
    paddingHorizontal: wp(3.5),
    borderRadius: 20,
    backgroundColor: 'rgba(255, 77, 77, 0.4)',
    borderWidth: 1.5,
    borderColor: '#ff4d4d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(3),
    // Premium glow effect
    shadowColor: '#ff4d4d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  sosOverlayText: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    marginLeft: wp(1.2),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* CAROUSEL SLIDE STYLES */
  slideFull: {
    width: wp(100),
    height: '100%',
  },
  promoSlide: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: hp(4), // Add space to push content down into the middle
    paddingBottom: hp(4), // Balanced padding
  },
  promoLeft: {
    flex: 1.4,
    justifyContent: 'center',
  },
  promoRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  adImage: {
    width: wp(35),
    height: hp(18),
  },
  promoBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.02 }],
  },
  promoBackgroundOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: wp(6),
    paddingVertical: hp(4),
  },
  promoBackgroundContent: {
    maxWidth: '55%',
  },
  featureVisualCard: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(8),
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  featureVisualGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureVisualImage: {
    width: '100%',
    height: '100%',
  },
  drivingPromoSubtitle: {
    color: '#60A5FA',
  },
  drivingPromoActionText: {
    color: '#60A5FA',
  },
  drivingFeatureVisualCard: {
    borderColor: 'rgba(96,165,250,0.26)',
  },
  tripPlannerPromoSubtitle: {
    color: '#34D399',
  },
  tripPlannerPromoActionText: {
    color: '#34D399',
  },
  tripPlannerFeatureVisualCard: {
    borderColor: 'rgba(52,211,153,0.26)',
  },
  promoSubtitle: {
    color: '#aaa',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(0.5),
  },
  promoTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Black',
    marginBottom: hp(1.5),
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  promoDesc: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    lineHeight: hp(2),
    marginBottom: hp(2),
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  promoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    marginTop: hp(1),
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.8),
    borderRadius: 6,
    gap: wp(1),
  },
  promoBtnText: {
    color: '#000',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },
  promoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  promoActionText: {
    color: '#5F9EA0',
    fontSize: wp(4),
    fontWeight: '700',
  },
  odometerSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(10),
  },
  odometerImage: {
    width: wp(40),
    height: hp(14),
    marginBottom: hp(1.5),
  },
  odometerTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Black',
    textAlign: 'center',
    marginBottom: hp(0.5),
  },
  odometerSubtitle: {
    color: COLORS.primary,
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(1.5),
  },
  odometerDesc: {
    color: '#888',
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
    marginTop: hp(0.5),
  },
  odometerWarning: {
    color: '#ff4d4d',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    marginTop: hp(1),
  },

  odometerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    marginTop: hp(0.5),
  },
  odometerInfoText: {
    color: '#8E8E93',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
  },
  odometerBadge: {
    backgroundColor: 'rgba(95, 158, 160,0.2)',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.4)',
    marginTop: hp(1.2),
    alignSelf: 'flex-start',
  },
  odometerBadgeText: {
    color: COLORS.primary,
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
  },
  odometerWarningBadge: {
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderColor: 'rgba(255,77,77,0.2)',
  },
  odometerWarningBadgeText: {
    color: '#ff4d4d',
  },

  odometerAlertSlide: {
    backgroundColor: '#0D0D0D',
    borderWidth: hp('0.2%'),
    borderColor: 'rgba(255, 77, 77, 0.4)',
    marginHorizontal: wp(2),
    marginVertical: hp(1),
    borderRadius: 20,
  },

  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: hp(5), // Positioned above the overlapping vehicle input
    left: 0,
    right: 0,
    gap: wp(1.5),
  },
  dot: {
    width: wp(1.5),
    height: wp(1.5),
    borderRadius: wp(0.75),
  },
  dotActive: {
    backgroundColor: '#fff',
    width: wp(4),
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  /* NUMBER PLATE SECTION */
  numberPlateSection: {
    paddingHorizontal: wp(12),
    marginTop: -hp(2.8), // 50% of the 5.5hp height to overlap header
    marginBottom: hp(2.0),
    justifyContent: 'center',
    zIndex: 10, // Ensure it's above the header
  },
  numberPlateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: hp(5.5),
    overflow: 'hidden',
  },
  indContainer: {
    backgroundColor: '#003399',
    height: '100%',
    paddingHorizontal: wp(2),
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  flagEmoji: {
    fontSize: wp(2.8),
    lineHeight: wp(3.5),
  },
  indText: {
    fontFamily: 'Outfit-Black',
    color: '#fff',
    fontSize: wp(2.2),
    letterSpacing: 0.5,
  },
  numberPlatePlaceholderContainer: {
    flex: 1,
    paddingHorizontal: wp(2),
    justifyContent: 'center',
  },
  numberPlatePlaceholderText: {
    fontFamily: 'Outfit-Bold',
    color: colors.textPrimary,
    fontSize: wp(4.5),
    letterSpacing: 1.5,
  },
  searchButton: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(1),
  },

  /* VEHICLE SECTION */
  vehicleSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  vehicleTitle: {
    color: colors.textPrimary,
    fontSize: wp(4.5),
    fontWeight: '700',
    marginBottom: hp(1.5),
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  vehicleImageContainer: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: wp(1),
    justifyContent: 'center',
    alignItems: 'center',
    width: wp(28),
    height: wp(28),
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  vehicleDetails: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.8),
  },
  detailLabel: {
    color: '#999',
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: wp(3.2),
    fontFamily: 'Outfit-SemiBold',
  },
  chevronIcon: {
    alignSelf: 'center',
  },

  /* BANNER SECTION */
  bannerSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  insuranceBanner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: wp(4),
    paddingVertical: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: wp(3),
  },
  bannerImage: {
    width: wp(20),
    height: wp(20),
    marginRight: wp(1),
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: 'Outfit-Bold',
    color: colors.textPrimary,
    fontSize: wp(4),
    marginBottom: hp(0.5),
  },
  bannerDesc: {
    fontFamily: 'Outfit-Regular',
    color: '#999',
    fontSize: wp(3.2),
    lineHeight: hp(2.2),
  },
  payNowButton: {
    backgroundColor: '#5F9EA0',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.6),
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(1),
    alignSelf: 'flex-start',
  },
  payNowText: {
    color: '#0a0a0a',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },

  /* TRENDING VIDEOS */
  videoListContent: {
    paddingHorizontal: wp(5),
  },
  videoCard: {
    width: wp(60),
    marginRight: wp(4),
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoTag: {
    position: 'absolute',
    top: wp(2),
    left: wp(2),
    backgroundColor: 'rgba(95, 158, 160,0.9)',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.4),
    borderRadius: 4,
    zIndex: 10,
  },
  tagText: {
    color: '#0a0a0a',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
  },
  videoThumbnail: {
    width: '100%',
    height: hp(18),
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  playButtonOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewCount: {
    position: 'absolute',
    bottom: wp(2),
    right: wp(2),
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: 4,
    fontSize: wp(3),
    fontFamily: 'Outfit-SemiBold',
    zIndex: 11,
  },
  videoTitle: {
    color: colors.textPrimary,
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    padding: wp(3),
    lineHeight: hp(2.2),
  },
  videoCardInfo: {
    padding: wp(3),
    gap: hp(0.5),
  },
  videoCardTitle: {
    color: colors.textPrimary,
    fontSize: wp(3.3),
    fontFamily: 'Outfit-Bold',
    lineHeight: wp(4.5),
  },
  videoCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: hp(0.5),
  },
  videoCardDetails: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Medium',
  },
  latestBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: wp(1.5),
    paddingVertical: hp(0.2),
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  latestLabel: {
    color: '#22C55E',
    fontSize: wp(2),
    fontFamily: 'Outfit-Black',
    letterSpacing: 0.5,
  },

  /* NEWS CARDS */
  newsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: wp(4.5),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  newsContent: {
    flex: 1,
  },
  newsTitle: {
    color: colors.textPrimary,
    fontSize: wp(4),
    fontFamily: 'Outfit-SemiBold',
    marginBottom: hp(0.5),
  },
  newsSnippet: {
    color: '#999',
    fontSize: wp(3.5),
    marginBottom: hp(0.5),
  },
  newsTime: {
    color: '#666',
    fontSize: wp(3),
  },

  /* FUEL PRICES */
  fuelSection: {
    marginHorizontal: wp(5),
    marginBottom: hp(2.5),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fuelHeaderBanner: {
    backgroundColor: '#5F9EA0',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelHeaderTitle: {
    color: '#333',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  fuelHeaderLeft: {
    flex: 1,
    gap: hp(0.2),
  },
  locationTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  locationTrackText: {
    color: '#333',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    flex: 1,
  },
  stateButton: {
    backgroundColor: '#fff',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(0.8),
  },
  stateButtonText: {
    color: '#0a0a0a',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },
  fuelContentCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: wp(2),
    paddingVertical: hp(2.5),
    gap: hp(1.5),
  },
  fuelInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  fuelInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  fuelInlineLabel: {
    color: '#999',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  fuelInlineValue: {
    color: '#5F9EA0',
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
  },
  fuelInlineSpacer: {
    width: 1,
    height: hp(3),
    backgroundColor: '#333',
  },
  viewTrendsButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  viewTrendsText: {
    color: colors.textPrimary,
    fontSize: wp(3.2),
    fontFamily: 'Outfit-SemiBold',
  },
  fuelLoader: {
    marginVertical: hp(2),
  },
  loadingText: {
    color: '#888',
    fontSize: wp(4),
    textAlign: 'center',
    paddingVertical: hp(2),
  },

  /* COMING SOON */
  comingSoonBadge: {
    width: wp(90),
    height: hp(40),
    alignSelf: 'center',
    marginTop: hp(-4),
    marginBottom: hp(-15),
  },

  /* STATE SELECTION MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: hp(80),
    paddingTop: hp(2),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
  },
  stateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedStateOption: {
    backgroundColor: 'rgba(95, 158, 160,0.2)',
  },
  stateOptionText: {
    color: colors.textPrimary,
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
  },

  /* STATE SEARCH */
  stateSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    marginHorizontal: wp(5),
    marginBottom: hp(2),
    paddingHorizontal: wp(3),
    height: hp(5),
    gap: wp(2),
    borderWidth: 0,
  },
  searchIcon: {
    marginRight: wp(1),
  },
  stateSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
    paddingVertical: hp(1),
  },

  /* FULL HEIGHT AD */
  fullAdSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
    marginTop: hp(-1), // Reduced top spacing as requested
    width: wp(100), // Taking full available viewport instead of arbitrary percentage wrapper
    alignItems: 'center',
  },
  fullAdTitle: {
    color: colors.textPrimary,
    fontSize: wp(5),
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: hp(1.5),
  },
  fullAdImage: {
    width: wp(90),
    height: hp(40), // Adjusted to reduce letterbox whitespace and fit closely above the button
    borderRadius: 12,
  },
  exploreAdButton: {
    backgroundColor: '#5F9EA0',
    paddingHorizontal: wp(12),
    paddingVertical: hp(1.6),
    borderRadius: 8,
    marginTop: hp(-2), // Pull the button slightly up against the image bounds
  },
  exploreAdButtonText: {
    color: '#0a0a0a',
    fontSize: wp(4.5),
    fontWeight: '800',
  },

  videoModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  videoModalCard: {
    position: 'absolute',
    top: hp(18),
    left: wp(4),
    width: wp(58),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 16,
    zIndex: 1001,
  },
  videoModalCardExpanded: {
    top: hp(9),
    left: wp(6),
    width: wp(88),
    borderRadius: 18,
  },
  videoModalCardDragging: {
    elevation: 6,
    shadowOpacity: 0,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  videoModalDragHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(0.25),
  },
  videoModalDragHandle: {
    width: wp(8),
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginRight: wp(1.8),
  },
  inlinePlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(2.2),
    paddingVertical: hp(0.55),
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  inlinePlayerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  inlinePlayerActionButton: {
    padding: wp(0.5),
  },
  inlinePlayerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: wp(2.9),
    fontFamily: 'Outfit-Medium',
    marginRight: wp(1.2),
  },
  inlinePlayerClose: {
    padding: wp(0.5),
  },
  inlinePlayerFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  inlinePlayerFrameExpanded: {
    width: '100%',
    height: hp(44),
    backgroundColor: '#000',
  },
  inlinePlayer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoExpandOverlayButton: {
    position: 'absolute',
    right: wp(2),
    bottom: hp(1),
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ACTIVE VIDEO CARD (currently playing) */
  videoCardActive: {
    borderWidth: 2,
    borderColor: '#5F9EA0',
    borderRadius: 12,
  },
  });
}

// NOTE: healthStyles is rendered over the vehicle-photo hero banner (see
// VehicleSlide.tsx / HealthDisplay.tsx) with text-shadow treatments tuned for
// legibility over an image — left un-themed intentionally (see report).
export function createHealthStyles(_colors: ThemeColors) {
  return StyleSheet.create({
  container: { marginTop: hp(1.5) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    marginBottom: hp(0.8),
  },
  score: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(10),
    lineHeight: wp(11),
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  scoreUnit: { fontSize: wp(5), opacity: 0.5 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    alignSelf: 'center',
  },
  statusText: { fontFamily: 'Outfit-Black', fontSize: wp(3), letterSpacing: 1 },
  barBg: {
    width: wp(55),
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: hp(0.5),
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  subLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.3)',
    fontSize: wp(2.2),
    letterSpacing: 1.5,
  },
  });
}
