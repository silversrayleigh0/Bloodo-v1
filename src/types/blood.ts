/**
 * BloodConnect Domain Entities
 * Production-ready TypeScript Interfaces for Supabase Integration
 */

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';

export type RequestStatus = 'open' | 'contacted' | 'fulfilled' | 'expired' | 'cancelled';

export interface User {
  id: string; // uuid
  firebase_uid: string;
  name: string;
  phone: string;
  age: number;
  gender: string | null;
  blood_group: BloodGroup;
  state: string;
  district: string;
  city: string | null;
  is_available: boolean;
  snoozed_until: string | null; // ISO string
  last_donated_at: string | null; // ISO string
  total_donations: number;
  search_appearances: number;
  created_at: string;
  updated_at: string;
}

export interface DonorProfile extends User {
  // Can include extra computed fields if needed
}

export interface BloodRequest {
  id: string;
  requester_name: string;
  requester_phone: string;
  blood_group: BloodGroup;
  units_required: number;
  required_on: string; // string (date)
  reason: string | null;
  hospital_name: string | null;
  state: string;
  district: string;
  city: string | null;
  status: RequestStatus;
  created_at: string;
}

export interface SearchResult {
  id: string;
  name: string;
  blood_group: BloodGroup;
  city: string | null;
  district: string;
  is_available: boolean;
  last_donated_at: string | null;
  total_donations: number;
  ring_label: 'exact_match_same_district' | 'compatible_same_district' | 'exact_match_adjacent_district';
  distance?: number; // Optional UI helper
}

export interface EligibilityResult {
  eligible: boolean;
  days_remaining: number;
}
