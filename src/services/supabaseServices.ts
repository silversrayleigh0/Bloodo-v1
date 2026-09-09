import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
// Replace with your actual project URL and Anon Key from Supabase Dashboard
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 1. Registering a Donor
 */
export const registerDonor = async (userData: any) => {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        name: userData.name,
        phone: userData.phone,
        age: userData.age,
        gender: userData.gender,
        blood_group: userData.bloodGroup,
        state: userData.state,
        district: userData.district,
        city: userData.city,
        firebase_uid: userData.firebaseUid,
        is_available: true
      }
    ])
    .select();

  if (error) throw error;
  return data;
};

/**
 * 2. Searching for Donors by Blood Group and District
 * This calls our custom Postgres function 'nearby_donors'
 */
export const searchDonors = async (bloodGroup: string, district: string) => {
  const { data, error } = await supabase
    .rpc('nearby_donors', {
      needed_group: bloodGroup,
      target_district: district
    });

  if (error) throw error;
  return data;
};

/**
 * 3. Posting a Blood Request
 */
export const postBloodRequest = async (requestData: any) => {
  const { data, error } = await supabase
    .from('requests')
    .insert([
      {
        requester_name: requestData.requesterName,
        requester_phone: requestData.requesterPhone,
        blood_group: requestData.bloodGroup,
        units_required: requestData.unitsRequired,
        required_on: requestData.requiredOn,
        reason: requestData.reason,
        hospital_name: requestData.hospitalName,
        state: requestData.state,
        district: requestData.district,
        city: requestData.city,
        posted_by: 'public'
      }
    ])
    .select();

  if (error) throw error;
  return data;
};

/**
 * 4. Fetching Unread Notifications for a Donor
 */
export const fetchUnreadNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Bonus: Calling Compatible Donors
 */
export const searchCompatibleDonors = async (bloodGroup: string, district: string) => {
  const { data, error } = await supabase
    .rpc('compatible_donors', {
      needed_group: bloodGroup,
      target_district: district
    });

  if (error) throw error;
  return data;
};
