import { createClient } from '@supabase/supabase-js';
import { 
  User, 
  BloodRequest, 
  SearchResult, 
  DonorProfile, 
  BloodGroup 
} from '../types/blood';

// You would replace these with your actual Supabase credentials
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 1. Register a new donor after Firebase OTP verification
 */
export async function registerDonor(profile: Partial<User>): Promise<{ data: User | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('register_donor', {
      p_firebase_uid: profile.firebase_uid,
      p_name: profile.name,
      p_phone: profile.phone,
      p_age: profile.age,
      p_gender: profile.gender,
      p_blood_group: profile.blood_group,
      p_state: profile.state,
      p_district: profile.district,
      p_city: profile.city,
      p_last_donated_at: profile.last_donated_at
    });

  if (error) return { data: null, error: error.message };
  return { data: data[0], error: null };
}

/**
 * 2. Login — fetch donor profile by firebase_uid on app open
 */
export async function getDonorProfile(firebaseUid: string): Promise<{ data: DonorProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as DonorProfile, error: null };
}

/**
 * 3. Search donors by blood group and district
 */
export async function searchDonors(
  neededGroup: BloodGroup, 
  district: string, 
  state: string
): Promise<{ data: SearchResult[]; error: string | null }> {
  const { data, error } = await supabase
    .rpc('search_donors', {
      needed_blood_group: neededGroup,
      search_district: district,
      search_state: state
    });

  if (error) return { data: [], error: error.message };
  return { data: data as SearchResult[], error: null };
}

/**
 * 4. Post a blood request
 */
export async function postBloodRequest(request: Partial<BloodRequest>): Promise<{ data: BloodRequest | null; error: string | null }> {
  const { data, error } = await supabase
    .from('requests')
    .insert([request])
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as BloodRequest, error: null };
}

/**
 * 5. Reveal a donor's phone number after contact is initiated
 */
export async function revealDonorContact(donorId: string, requestId: string): Promise<{ phone: string | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('reveal_contact', {
      p_donor_id: donorId,
      p_request_id: requestId
    });

  if (error) return { phone: null, error: error.message };
  return { phone: data as string, error: null };
}

/**
 * 6. Log a new donation and update eligibility
 */
export async function logDonation(firebaseUid: string, donatedAt: Date): Promise<{ data: User | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc('log_donation', {
      p_firebase_uid: firebaseUid,
      p_donated_at: donatedAt.toISOString()
    });

  if (error) return { data: null, error: error.message };
  return { data: data[0] as User, error: null };
}
