export const HOME_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Puducherry',
  'Chandigarh',
  'Ladakh',
  'Jammu and Kashmir',
] as const;

export type HomeCarouselSlide =
  | 'vehicle'
  | 'expenses'
  | 'services'
  | 'social'
  | 'drivingBehavior'
  | 'tripPlanner'
  | 'odometer';

export type HomeFuelPrices = {
  petrol: number;
  diesel: number;
  cng?: number;
};

export type SelectedVideo = {
  id: string;
  embedUrl: string;
  title: string;
};

export type TimelineItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  iconSet: 'fa' | 'mc' | 'ion';
  accent: string;
  badge: string;
  cta: string;
  stage: 'Now' | 'Next' | 'Later';
  priority: 'urgent' | 'normal' | 'good';
  priorityScore: number;
  onPress: () => void;
};
