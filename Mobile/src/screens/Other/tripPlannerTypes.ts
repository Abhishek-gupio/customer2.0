export type TravelerType = 'solo' | 'couple' | 'family' | 'friends';
export type Preference = 'adventure' | 'relaxation' | 'culture' | 'food' | 'nightlife' | 'sights' | 'nature';

export interface PlanningState {
  arrivalDate: string | null;
  departureDate: string | null;
  stayDays: number;
  travelerType: TravelerType;
  numberOfPeople?: number;
  preferences: Preference[];
  budget: number;
  selectedHotelId?: string;
  selectedActivities: string[];
  selectedBikeId?: string;
  weather?: { condition: string; icon: string };
  currentStep: number;
}

export interface Hotel {
  id: string;
  name: string;
  price: number;
  rating: number;
  image: string;
  distance: string;
}

export interface Activity {
  id: string;
  name: string;
  category: Preference;
  originalType: string;
  openTime: string;
  closeTime: string;
  price: number;
  image: string;
  location: string;
}
