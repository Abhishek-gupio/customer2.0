export type TravelerType = 'solo' | 'couple' | 'family' | 'friends';
export type Preference = 'adventure' | 'relaxation' | 'culture' | 'food' | 'nightlife' | 'sights' | 'nature';

export interface SelectedHotelDetails {
  id: string;
  name: string;
  address?: string;
  image?: string;
  distance?: string;
  price?: number;
  priceMax?: number;
  rating?: number;
  openNow?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface SelectedActivityDetails {
  id: string;
  name: string;
  category: Preference;
  location?: string;
  address?: string;
  image?: string;
  price?: number;
  openTime?: string;
  openNow?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface SelectedTransportDetails {
  id: string;
  name: string;
  category?: 'bikes' | 'cars' | 'cabs' | 'personal';
  type?: string;
  source?: 'default' | 'nearby';
  image?: string;
  priceLabel?: string;
  priceVal?: number;
  distanceText?: string;
  rating?: number;
  openNow?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface PlanningState {
  arrivalDate: string | null;
  departureDate: string | null;
  stayDays: number;
  travelerType: TravelerType;
  numberOfPeople?: number;
  selectedRouteIndex?: number;
  preferences: Preference[];
  budget: number;
  hotelBudget?: number;
  activityBudget?: number;
  transportBudget?: number;
  selectedHotelId?: string;
  selectedHotelDetails?: SelectedHotelDetails;
  selectedActivities: string[];
  selectedActivityDetails?: SelectedActivityDetails[];
  selectedBikeId?: string;
  selectedTransportDetails?: SelectedTransportDetails;
  weather?: { condition: string; icon: string };
  currentStep: number;
}

export interface Hotel {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  // Estimated nightly pricing bucket (0 when unknown)
  price: number;
  priceMax?: number;
  priceLevel?: number;
  rating: number;
  ratingCount?: number;
  image: string;
  distance: string;
  distanceKm?: number;
  openNow?: boolean;
}

export interface Activity {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category: Preference;
  originalType: string;
  openTime: string;
  closeTime: string;
  price: number;
  priceLevel?: number;
  openNow?: boolean;
  isPriceEstimated?: boolean;
  image: string;
  location: string;
}
