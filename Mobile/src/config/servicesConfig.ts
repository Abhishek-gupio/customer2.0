import type { ImageSourcePropType } from 'react-native';
import type {
  NearbyPlaceRouteType,
  RootStackParamList,
  ServiceStackParamList,
} from '../navigation/types';
import type { NearbyPlaceType } from '../services/placesService';

const DrivingIcon = require('../assets/images/driving_icon.jpg') as ImageSourcePropType;

export type ServiceIconSet = 'fa' | 'mc' | 'parking' | 'towing';

export type QuickServiceId =
  | 'service'
  | 'nearby'
  | 'driving'
  | 'support'
  | 'garage'
  | 'document'
  | 'expense'
  | 'tripcost'
  | 'valet';

export type ServiceHubId =
  | 'PartsWarranty'
  | 'ServiceHistory'
  | 'NearbyPlaces'
  | 'CheckChallan'
  | 'FuelStations'
  | 'ChargingStation'
  | 'Mechanics'
  | 'RTO'
  | 'Towing'
  | 'Parking'
  | 'Insurance'
  | 'TripExpense'
  | 'DLVerification'
  | 'Fastag';

export type ServiceDestination =
  | {
      navigator: 'root';
      screen: keyof RootStackParamList;
      params?: Record<string, unknown>;
    }
  | {
      navigator: 'services';
      screen: keyof ServiceStackParamList;
      params?: Record<string, unknown>;
    };

export type QuickServiceItem = {
  id: QuickServiceId;
  icon: string | ImageSourcePropType;
  label: string;
  destination: ServiceDestination;
};

export type ServiceHubItem = {
  id: ServiceHubId;
  name: string;
  icon: string;
  iconSet: ServiceIconSet;
  destination: ServiceDestination;
};

export type ServiceHubCategory = {
  title: string;
  itemIds: ServiceHubId[];
  color: string;
};

export type ServiceHubAd = {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  theme: string;
  icon: string;
  iconSet: ServiceIconSet | 'fa';
  targetId: ServiceHubId;
};

export type ServiceOptionItem = {
  serviceId: ServiceHubId;
  title: string;
  icon: string;
  iconSet: 'ion';
};

export type HomePromoAction =
  | {
      type: 'destination';
      destination: ServiceDestination;
    }
  | {
      type: 'serviceHub';
      serviceId: ServiceHubId;
    }
  | {
      type: 'serviceOptions';
    }
  | {
      type: 'externalUrl';
      url: string;
    };

export type HomeServicePromo = {
  subtitle: string;
  title: string;
  desc: string;
  ctaLabel: string;
  accent: string;
  image: ImageSourcePropType;
  action: HomePromoAction;
};

export type ComingSoonServiceItem = {
  id: string;
  title: string;
  icon: string;
};

export type HomeCarouselPromoAction = {
  id: string;
  label: string;
  icon: string;
  iconSet: 'fa' | 'mc';
  variant: 'primary' | 'secondary';
  action: HomePromoAction;
};

export type HomeSplitPromo = {
  subtitle: string;
  title: string;
  desc: string;
  ctaLabel: string;
  accent: string;
  image: ImageSourcePropType;
  action: HomePromoAction;
};

export type HomeBackgroundPromo = {
  subtitle: string;
  title: string;
  desc: string;
  ctaLabel: string;
  accent: string;
  image: ImageSourcePropType;
  gradientColors: [string, string, string];
  action: HomePromoAction;
};

export type HomeSocialPromo = {
  subtitle: string;
  title: string;
  image: ImageSourcePropType;
  actions: HomeCarouselPromoAction[];
};

export type NearbyServiceId = NearbyPlaceRouteType;

export type NearbyServiceItem = {
  id: NearbyServiceId;
  name: string;
  shortName: string;
  icon: string;
  iconSet: 'fa' | 'mc';
  apiType: NearbyPlaceType;
  marker: {
    iconSet: 'fa' | 'mc';
    icon: string;
    bg: string;
    fg: string;
  };
  showInPicker?: boolean;
};

function nearbyPlaceDestination(placeType?: NearbyPlaceRouteType): ServiceDestination {
  return {
    navigator: 'services',
    screen: 'NearbyPlaces',
    params: placeType ? { placeType } : undefined,
  };
}

export const quickServices: QuickServiceItem[] = [
  {
    id: 'garage',
    icon: 'car',
    label: 'My Garage',
    destination: { navigator: 'root', screen: 'VehicleList' },
  },
  {
    id: 'document',
    icon: 'file-alt',
    label: 'Documents',
    destination: { navigator: 'root', screen: 'DocumentList' },
  },
  {
    id: 'expense',
    icon: 'wallet',
    label: 'Expenses',
    destination: { navigator: 'root', screen: 'Expenses' },
  },
  {
    id: 'tripcost',
    icon: 'map-signs',
    label: 'Trip Planner',
    destination: { navigator: 'root', screen: 'TripExpense' },
  },
  {
    id: 'service',
    icon: 'wrench',
    label: 'Service',
    destination: { navigator: 'services', screen: 'ServicesHome' },
  },
  {
    id: 'nearby',
    icon: 'map-marker-alt',
    label: 'Near By',
    destination: {
      navigator: 'services',
      screen: 'NearbyPlaces',
      params: { fromHome: true },
    },
  },
  {
    id: 'driving',
    icon: DrivingIcon,
    label: 'Driving',
    destination: { navigator: 'root', screen: 'DrivingSummary' },
  },
  {
    id: 'support',
    icon: 'comments',
    label: 'Support',
    destination: { navigator: 'root', screen: 'HelpSupport' },
  },
  {
    id: 'valet',
    icon: 'parking',
    label: 'Valet Parking',
    destination: { navigator: 'root', screen: 'Valet' },
  },
];

export const serviceHubItems: ServiceHubItem[] = [
  {
    id: 'PartsWarranty',
    name: 'Vehicle Health',
    icon: 'shield-alt',
    iconSet: 'fa',
    destination: { navigator: 'services', screen: 'WarrantyStatus' },
  },
  {
    id: 'ServiceHistory',
    name: 'Service History',
    icon: 'history',
    iconSet: 'fa',
    destination: { navigator: 'services', screen: 'ServiceHistory' },
  },
  {
    id: 'NearbyPlaces',
    name: 'Nearby Finder',
    icon: 'map-marker-alt',
    iconSet: 'fa',
    destination: nearbyPlaceDestination(),
  },
  {
    id: 'CheckChallan',
    name: 'Challan Check',
    icon: 'gavel',
    iconSet: 'fa',
    destination: { navigator: 'services', screen: 'CheckChallan' },
  },
  {
    id: 'FuelStations',
    name: 'Fuel Nearby',
    icon: 'gas-station',
    iconSet: 'mc',
    destination: nearbyPlaceDestination('FuelStations'),
  },
  {
    id: 'ChargingStation',
    name: 'EV Charge',
    icon: 'ev-station',
    iconSet: 'mc',
    destination: nearbyPlaceDestination('ChargingStation'),
  },
  {
    id: 'Mechanics',
    name: 'Mechanic Help',
    icon: 'wrench',
    iconSet: 'fa',
    destination: nearbyPlaceDestination('Mechanics'),
  },
  {
    id: 'RTO',
    name: 'RTO Office',
    icon: 'landmark',
    iconSet: 'fa',
    destination: nearbyPlaceDestination('RTO'),
  },
  {
    id: 'Towing',
    name: 'Tow Help',
    icon: 'truck-pickup',
    iconSet: 'towing',
    destination: nearbyPlaceDestination('Towing'),
  },
  {
    id: 'Parking',
    name: 'Parking',
    icon: 'parking',
    iconSet: 'parking',
    destination: nearbyPlaceDestination('Parking'),
  },
  {
    id: 'Insurance',
    name: 'Insurance Help',
    icon: 'shield-check',
    iconSet: 'mc',
    destination: nearbyPlaceDestination('Insurance'),
  },
  {
    id: 'TripExpense',
    name: 'Trip Cost',
    icon: 'map-signs',
    iconSet: 'fa',
    destination: { navigator: 'root', screen: 'TripExpense' },
  },
  {
    id: 'DLVerification',
    name: 'DL Verify',
    icon: 'id-card',
    iconSet: 'fa',
    destination: { navigator: 'root', screen: 'DLVerification' },
  },
  {
    id: 'Fastag',
    name: 'FASTag',
    icon: 'receipt',
    iconSet: 'fa',
    destination: { navigator: 'root', screen: 'Fastag' },
  },
];

export const serviceHubCategories: ServiceHubCategory[] = [
  {
    title: 'Vehicle Health & Care',
    itemIds: ['PartsWarranty', 'ServiceHistory'],
    color: '#ef4444',
  },
  {
    title: 'Information & RTO',
    itemIds: ['CheckChallan', 'RTO', 'DLVerification', 'Fastag'],
    color: '#FFBF00',
  },
  {
    title: 'Travel & Planning',
    itemIds: ['TripExpense'],
    color: '#6366f1',
  },
];

export const serviceHubAds: ServiceHubAd[] = [
  {
    id: '1',
    title: 'Traffic Challans',
    subtitle: 'Check & Settle Fines',
    desc: 'Avoid late fees and court visits. Check your vehicle status now.',
    theme: '#fbbf24',
    icon: 'gavel',
    iconSet: 'fa',
    targetId: 'CheckChallan',
  },
  {
    id: '2',
    title: 'Smart Parking',
    subtitle: 'Nearby parking',
    desc: 'See parking options around you and jump straight into directions.',
    theme: '#60a5fa',
    icon: 'parking',
    iconSet: 'parking',
    targetId: 'Parking',
  },
  {
    id: '3',
    title: 'Nearby Mechanics',
    subtitle: 'Quick local help',
    desc: 'Browse mechanics around you when you need service support fast.',
    theme: '#94a3b8',
    icon: 'wrench',
    iconSet: 'fa',
    targetId: 'Mechanics',
  },
  {
    id: '4',
    title: 'Vehicle Health',
    subtitle: 'Smart Tracking',
    desc: 'Monitor your vehicle health score and parts lifecycle easily.',
    theme: '#4ade80',
    icon: 'heartbeat',
    iconSet: 'fa',
    targetId: 'PartsWarranty',
  },
];

export const serviceOptionItems: ServiceOptionItem[] = [
  {
    serviceId: 'ServiceHistory',
    title: 'Service History',
    icon: 'time-outline',
    iconSet: 'ion',
  },
  {
    serviceId: 'PartsWarranty',
    title: 'Parts Warranty Status',
    icon: 'shield-checkmark-outline',
    iconSet: 'ion',
  },
];

export const homeServicePromos = {
  featuredServices: {
    subtitle: 'Premium Care',
    title: 'Featured Services',
    desc: 'Book maintenance, car wash, and emergency repairs instantly.',
    ctaLabel: 'Explore',
    accent: '#4ade80',
    image: require('../assets/images/vehicle_AD.png') as ImageSourcePropType,
    action: { type: 'serviceOptions' },
  },
  tripPlanner: {
    subtitle: 'Plan Your Journey',
    title: 'Trip Planner',
    desc: 'Build your route, estimate costs, and organize stops before you travel.',
    ctaLabel: 'Start Planning',
    accent: '#34D399',
    image: require('../assets/images/trip_planner_banner.png') as ImageSourcePropType,
    action: { type: 'serviceHub', serviceId: 'TripExpense' },
  },
  challanBanner: {
    subtitle: 'Traffic Challans',
    title: 'Check Your Challans & Avoid Trouble!',
    desc: 'Settle now to avoid late fees and skip the hassle of going to court.',
    ctaLabel: 'Check Now',
    accent: '#fbbf24',
    image: require('../assets/images/challan.png') as ImageSourcePropType,
    action: { type: 'serviceHub', serviceId: 'CheckChallan' },
  },
} as const;

export const homeCarouselPromos = {
  expenseTracker: {
    subtitle: 'Smart Tracking',
    title: 'Expense Tracker',
    desc: 'Monitor your fuel, service and other vehicle costs easily.',
    ctaLabel: 'Try Now',
    accent: '#FFBF00',
    image: require('../assets/images/expense_AD.png') as ImageSourcePropType,
    action: {
      type: 'destination',
      destination: { navigator: 'root', screen: 'Expenses' },
    },
  } satisfies HomeSplitPromo,
  social: {
    subtitle: 'Stay Connected',
    title: 'Follow Us on Instagram',
    image: require('../assets/images/insta&website_AD.png') as ImageSourcePropType,
    actions: [
      {
        id: 'instagram',
        label: 'Instagram',
        icon: 'instagram',
        iconSet: 'fa',
        variant: 'primary',
        action: { type: 'externalUrl', url: 'https://www.instagram.com/gupio.in/' },
      },
      {
        id: 'website',
        label: 'Website',
        icon: 'earth',
        iconSet: 'mc',
        variant: 'secondary',
        action: { type: 'externalUrl', url: 'https://gupio.in/' },
      },
    ],
  } satisfies HomeSocialPromo,
  drivingBehavior: {
    subtitle: 'Drive Safely',
    title: 'Driving Behavior',
    desc: 'Check speeding, braking, and trip safety insights in one place.',
    ctaLabel: 'View Driving Score',
    accent: '#60A5FA',
    image: require('../assets/images/driving_behavior_banner_v2.png') as ImageSourcePropType,
    gradientColors: ['rgba(5,7,10,0.82)', 'rgba(5,7,10,0.46)', 'rgba(5,7,10,0.14)'],
    action: {
      type: 'destination',
      destination: { navigator: 'root', screen: 'DrivingSummary' },
    },
  } satisfies HomeBackgroundPromo,
} as const;

export const comingSoonServiceItems: ComingSoonServiceItem[] = [
  {
    id: 'ev-charging',
    title: 'EV Charging',
    icon: 'car-electric',
  },
  {
    id: 'car-wash',
    title: 'Car Wash',
    icon: 'car-wash',
  },
  {
    id: 'emergency',
    title: 'Emergency',
    icon: 'tow-truck',
  },
];

export const nearbyServices: NearbyServiceItem[] = [
  {
    id: 'FuelStations',
    name: 'Fuel Stations',
    shortName: 'Fuel',
    icon: 'gas-station',
    iconSet: 'mc',
    apiType: 'gas_station',
    marker: { iconSet: 'mc', icon: 'gas-station', bg: '#FFBF00', fg: '#111111' },
    showInPicker: true,
  },
  {
    id: 'Hospital',
    name: 'Hospital',
    shortName: 'Hospital',
    icon: 'hospital',
    iconSet: 'fa',
    apiType: 'hospital',
    marker: { iconSet: 'fa', icon: 'hospital', bg: '#ef4444', fg: '#ffffff' },
    showInPicker: true,
  },
  {
    id: 'PoliceStation',
    name: 'Police Station',
    shortName: 'Police',
    icon: 'building',
    iconSet: 'fa',
    apiType: 'police',
    marker: { iconSet: 'fa', icon: 'building', bg: '#6366f1', fg: '#ffffff' },
    showInPicker: true,
  },
  {
    id: 'Hotel',
    name: 'Hotel',
    shortName: 'Hotel',
    icon: 'hotel',
    iconSet: 'fa',
    apiType: 'lodging',
    marker: { iconSet: 'fa', icon: 'hotel', bg: '#f59e0b', fg: '#111111' },
    showInPicker: true,
  },
  {
    id: 'ChargingStation',
    name: 'Charging Station',
    shortName: 'EV Charge',
    icon: 'ev-station',
    iconSet: 'mc',
    apiType: 'electric_charging_station',
    marker: { iconSet: 'mc', icon: 'ev-station', bg: '#22c55e', fg: '#0a0a0a' },
    showInPicker: true,
  },
  {
    id: 'Mechanics',
    name: 'Mechanics',
    shortName: 'Mechanic',
    icon: 'wrench',
    iconSet: 'fa',
    apiType: 'car_repair',
    marker: { iconSet: 'fa', icon: 'wrench', bg: '#60a5fa', fg: '#0a0a0a' },
    showInPicker: true,
  },
  {
    id: 'RTO',
    name: 'RTO',
    shortName: 'RTO',
    icon: 'landmark',
    iconSet: 'fa',
    apiType: 'local_government_office',
    marker: { iconSet: 'fa', icon: 'landmark', bg: '#f97316', fg: '#111111' },
    showInPicker: true,
  },
  {
    id: 'Towing',
    name: 'Towing',
    shortName: 'Towing',
    icon: 'truck-pickup',
    iconSet: 'fa',
    apiType: 'car_repair',
    marker: { iconSet: 'fa', icon: 'truck-pickup', bg: '#94a3b8', fg: '#111111' },
    showInPicker: true,
  },
  {
    id: 'CarWash',
    name: 'Car Wash',
    shortName: 'Car Wash',
    icon: 'car-wash',
    iconSet: 'mc',
    apiType: 'car_wash',
    marker: { iconSet: 'mc', icon: 'car-wash', bg: '#38bdf8', fg: '#0a0a0a' },
    showInPicker: true,
  },
  {
    id: 'Insurance',
    name: 'Insurance',
    shortName: 'Insurance',
    icon: 'shield-alt',
    iconSet: 'fa',
    apiType: 'insurance_agency',
    marker: { iconSet: 'fa', icon: 'shield-alt', bg: '#34d399', fg: '#0a0a0a' },
  },
  {
    id: 'Parking',
    name: 'Parking',
    shortName: 'Parking',
    icon: 'parking',
    iconSet: 'fa',
    apiType: 'parking',
    marker: { iconSet: 'fa', icon: 'parking', bg: '#a3e635', fg: '#111111' },
    showInPicker: true,
  },
  {
    id: 'TyreShop',
    name: 'Tyre Shop',
    shortName: 'Tyre Shop',
    icon: 'car-tire-alert',
    iconSet: 'mc',
    apiType: 'car_repair',
    marker: { iconSet: 'mc', icon: 'car-tire-alert', bg: '#fb7185', fg: '#111111' },
    showInPicker: true,
  },
  {
    id: 'DocumentServices',
    name: 'Document Services',
    shortName: 'Documents',
    icon: 'file-alt',
    iconSet: 'fa',
    apiType: 'local_government_office',
    marker: { iconSet: 'fa', icon: 'file-alt', bg: '#c084fc', fg: '#111111' },
  },
  {
    id: 'CarSpa',
    name: 'Car Spa',
    shortName: 'Car Spa',
    icon: 'car-wash',
    iconSet: 'mc',
    apiType: 'car_wash',
    marker: { iconSet: 'mc', icon: 'car-wash', bg: '#2dd4bf', fg: '#111111' },
  },
  {
    id: 'TouristAttraction',
    name: 'Places to Visit',
    shortName: 'Visit',
    icon: 'map-marked-alt',
    iconSet: 'fa',
    apiType: 'tourist_attraction',
    marker: { iconSet: 'fa', icon: 'map-marked-alt', bg: '#e879f9', fg: '#111111' },
    showInPicker: true,
  },
];

export const nearbyPickerServices = nearbyServices.filter((service) => service.showInPicker);

export const nearbyServiceLabels = nearbyServices.reduce<Record<NearbyServiceId, string>>(
  (acc, service) => {
    acc[service.id] = service.name;
    return acc;
  },
  {} as Record<NearbyServiceId, string>,
);

export const nearbyServiceApiTypes = nearbyServices.reduce<Record<NearbyServiceId, NearbyPlaceType>>(
  (acc, service) => {
    acc[service.id] = service.apiType;
    return acc;
  },
  {} as Record<NearbyServiceId, NearbyPlaceType>,
);

export const nearbyServiceMarkerStyles = nearbyServices.reduce<Record<NearbyServiceId, NearbyServiceItem['marker']>>(
  (acc, service) => {
    acc[service.id] = service.marker;
    return acc;
  },
  {} as Record<NearbyServiceId, NearbyServiceItem['marker']>,
);

const quickServicesById = Object.fromEntries(
  quickServices.map((item) => [item.id, item]),
) as Record<QuickServiceId, QuickServiceItem>;

const serviceHubItemsById = Object.fromEntries(
  serviceHubItems.map((item) => [item.id, item]),
) as Record<ServiceHubId, ServiceHubItem>;

const nearbyServicesById = Object.fromEntries(
  nearbyServices.map((item) => [item.id, item]),
) as Record<NearbyServiceId, NearbyServiceItem>;

export function getQuickServiceById(id: QuickServiceId): QuickServiceItem | undefined {
  return quickServicesById[id];
}

export function getServiceHubItemById(id: ServiceHubId): ServiceHubItem | undefined {
  return serviceHubItemsById[id];
}

export function getNearbyServiceById(id: NearbyServiceId): NearbyServiceItem | undefined {
  return nearbyServicesById[id];
}
