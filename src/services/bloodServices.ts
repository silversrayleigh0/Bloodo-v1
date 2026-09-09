import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';

/**
 * 1. Registering a Donor
 */
export async function registerDonor(userId: string, donorData: any) {
  try {
    // Check if phone or email already exists
    const usersRef = collection(db, 'users');
    let existingUser = null;

    // Check phone
    const qPhone = query(usersRef, where('phone', '==', donorData.phone));
    const phoneSnap = await getDocs(qPhone);
    if (!phoneSnap.empty) {
      existingUser = phoneSnap.docs[0];
    }

    // Check email if phone not found
    if (!existingUser && donorData.email) {
      const qEmail = query(usersRef, where('email', '==', donorData.email));
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        existingUser = emailSnap.docs[0];
      }
    }
    
    if (existingUser && existingUser.id !== userId) {
      // If found but different UID, migrate account
      const oldData = existingUser.data();
      try {
        await deleteDoc(doc(db, 'users', existingUser.id));
      } catch (delErr) {
        console.warn("Failed to delete old record during migration. Continuing registration.", delErr);
      }
      
      // Merge old data with new registration data
      donorData = {
        ...oldData,
        ...donorData
      };
    }

    const userRef = doc(db, 'users', userId);
    
    // Normalize data for Firestore (ensure snake_case matches rules/blueprint)
    const normalizedData = {
      name: donorData.name,
      phone: donorData.phone,
      email: donorData.email || null,
      blood_group: donorData.blood_group || donorData.bloodGroup,
      state: donorData.state,
      district: donorData.district,
      city: donorData.city || '',
      gender: donorData.gender || 'Other',
      age: donorData.age || 25,
      last_donated_at: donorData.last_donated_at || null,
      is_available: donorData.is_available ?? donorData.isAvailable ?? true,
      total_donations: donorData.total_donations || 0,
      search_appearances: donorData.search_appearances || 0,
      firebase_uid: userId,
      photoURL: donorData.photoURL || null,
      role: donorData.role || 'donor',
      created_at: donorData.created_at || serverTimestamp(),
      updated_at: serverTimestamp()
    };
    
    await setDoc(userRef, normalizedData, { merge: true });
    return { id: userId, ...normalizedData };
  } catch (error: any) {
    const op = error.message?.includes('delete') ? 'delete' : 'create';
    handleFirestoreError(error, op as any, `users/${userId}`);
    return null;
  }
}

/**
 * Adjacent Districts Mapping for Search Rings
 */
const ADJACENT_DISTRICTS: Record<string, string[]> = {
  // Tamil Nadu
  'Chennai': ['Tiruvallur', 'Kanchipuram', 'Chengalpattu'],
  'Coimbatore': ['Tiruppur', 'Erode', 'Nilgiris', 'Dindigul'],
  'Madurai': ['Dindigul', 'Theni', 'Virudhunagar', 'Sivaganga', 'Ramanathapuram'],
  'Salem': ['Namakkal', 'Erode', 'Dharmapuri', 'Krishnagiri'],
  'Tiruchirappalli': ['Karur', 'Perambalur', 'Ariyalur', 'Thanjavur', 'Pudukkottai', 'Dindigul'],
  // Kerala
  'Thiruvananthapuram': ['Kollam'],
  'Kollam': ['Thiruvananthapuram', 'Pathanamthitta', 'Alappuzha'],
  'Ernakulam': ['Thrissur', 'Idukki', 'Kottayam', 'Alappuzha'],
  'Kozhikode': ['Malappuram', 'Wayanad', 'Kannur'],
  // Karnataka
  'Bengaluru Urban': ['Bengaluru Rural', 'Tumakuru', 'Ramanagara', 'Chikkaballapur', 'Kolar'],
  'Mysuru': ['Mandya', 'Chamarajanagar', 'Kodagu', 'Hassan'],
  // Maharashtra
  'Mumbai City': ['Mumbai Suburban', 'Thane'],
  'Pune': ['Raigad', 'Satara', 'Ahmednagar', 'Solapur'],
  // Telangana
  'Hyderabad': ['Ranga Reddy', 'Medchal–Malkajgiri', 'Sangareddy', 'Yadadri Bhuvanagiri'],
  // Andhra Pradesh
  'Visakhapatnam': ['Vizianagaram', 'Anakapalli', 'Alluri Sitharama Raju'],
  // Delhi Special Case (handled in logic or mapping)
  'Central Delhi': ['East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'East Delhi': ['Central Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'New Delhi': ['Central Delhi', 'East Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'North Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'North East Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'North West Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'Shahdara': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'South Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'South East Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South West Delhi', 'West Delhi'],
  'South West Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'West Delhi'],
  'West Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi'],
};

/**
 * Blood Group Compatibility Rules
 */
const COMPATIBILITY: Record<string, string[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-'],
};

/**
 * Eligibility Check helper
 */
export function checkEligibility(lastDonatedAt: any) {
  if (!lastDonatedAt) return { eligible: true, daysLeft: 0 };
  
  const lastDonated = lastDonatedAt instanceof Date ? lastDonatedAt : lastDonatedAt.toDate();
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastDonated.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const recoveryPeriod = 90; // Default 90 days
  const eligible = diffDays >= recoveryPeriod;
  const daysLeft = eligible ? 0 : recoveryPeriod - diffDays;
  
  return { eligible, daysLeft };
}

/**
 * 2. Searching for Donors by Blood Group and District (Rings Logic)
 */
export async function searchDonors(neededBloodGroup: string, searchDistrict: string, searchState: string) {
  try {
    const usersRef = collection(db, 'users');
    
    // Ring 1: Exact group, Same district, Same state
    const q1 = query(
      usersRef, 
      where('blood_group', '==', neededBloodGroup),
      where('state', '==', searchState),
      where('district', '==', searchDistrict),
      where('is_available', '==', true)
    );
    const snap1 = await getDocs(q1);
    let results = snap1.docs.map(doc => ({ id: doc.id, ...doc.data() as any, ring_label: 'exact_match_same_district' }));
    
    // Filter eligible
    results = results.filter(u => checkEligibility(u.last_donated_at).eligible);
    
    if (results.length > 0) {
      await incrementAppearances(results);
      return results.sort((a, b) => (b.total_donations || 0) - (a.total_donations || 0));
    }

    // Ring 2: Compatible group, Same district, Same state
    const compatibleGroups = COMPATIBILITY[neededBloodGroup] || [neededBloodGroup];
    const q2 = query(
      usersRef, 
      where('blood_group', 'in', compatibleGroups),
      where('state', '==', searchState),
      where('district', '==', searchDistrict),
      where('is_available', '==', true)
    );
    const snap2 = await getDocs(q2);
    results = snap2.docs.map(doc => ({ id: doc.id, ...doc.data() as any, ring_label: 'compatible_same_district' }));
    results = results.filter(u => checkEligibility(u.last_donated_at).eligible);
    
    if (results.length > 0) {
      await incrementAppearances(results);
      return results.sort((a, b) => (b.total_donations || 0) - (a.total_donations || 0));
    }

    // Ring 3: Exact group, Adjacent district
    const adjacent = ADJACENT_DISTRICTS[searchDistrict] || [];
    if (adjacent.length > 0) {
      const q3 = query(
        usersRef, 
        where('blood_group', '==', neededBloodGroup),
        where('district', 'in', adjacent),
        where('is_available', '==', true)
      );
      const snap3 = await getDocs(q3);
      results = snap3.docs.map(doc => ({ id: doc.id, ...doc.data() as any, ring_label: 'exact_match_adjacent_district' }));
      results = results.filter(u => checkEligibility(u.last_donated_at).eligible);
      
      if (results.length > 0) {
        await incrementAppearances(results);
        return results.sort((a, b) => (b.total_donations || 0) - (a.total_donations || 0));
      }
    }

    return [];
  } catch (error) {
    handleFirestoreError(error, 'list', 'users');
    return [];
  }
}

async function incrementAppearances(donors: any[]) {
  try {
    const promises = donors.map(d => updateDoc(doc(db, 'users', d.id), {
      search_appearances: (d.search_appearances || 0) + 1
    }));
    await Promise.all(promises);
  } catch (e) {
    console.error("Failed to increment appearances", e);
  }
}

/**
 * Log new donation for a donor
 */
export async function logDonation(userId: string, donatedAt: Date = new Date()) {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      await updateDoc(userRef, {
        last_donated_at: donatedAt,
        total_donations: (data.total_donations || 0) + 1,
        is_available: false, // Recovery mode
        updated_at: serverTimestamp()
      });
      return true;
    }
  } catch (e) {
    handleFirestoreError(e, 'update', `users/${userId}`);
  }
  return false;
}

/**
 * 3. Posting a Blood Request & Auto-Matching
 */
export async function postBloodRequest(requestData: any) {
  try {
    const requestsRef = collection(db, 'requests');
    const docRef = await addDoc(requestsRef, {
      ...requestData,
      status: 'open',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    const requestId = docRef.id;

    // --- AUTO-MATCHING LOGIC ---
    // Find donors who MUST match: Blood Group, State, and District
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('blood_group', '==', requestData.blood_group),
      where('state', '==', requestData.state),
      where('district', '==', requestData.district),
      where('is_available', '==', true)
    );

    const snapshot = await getDocs(q);
    const donors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Filter by eligibility
    const eligibleDonors = donors.filter(d => checkEligibility(d.last_donated_at).eligible);

    if (eligibleDonors.length > 0) {
      const matchPromises = eligibleDonors.map(async (donor) => {
        // 1. Create Match record
        const matchRef = collection(db, 'matches');
        await addDoc(matchRef, {
          request_id: requestId,
          donor_id: donor.id,
          status: 'pending',
          created_at: serverTimestamp()
        });

        // 2. Create Notification
        const notifRef = collection(db, 'notifications');
        await addDoc(notifRef, {
          user_id: donor.id,
          type: 'new_request',
          title: 'Urgent Help Needed!',
          bloodGroup: requestData.blood_group,
          hospital: requestData.hospital,
          district: requestData.district,
          message: `Someone in ${requestData.city || requestData.district} needs ${requestData.blood_group}. Can you help?`,
          is_read: false,
          related_request_id: requestId,
          created_at: serverTimestamp()
        });
      });

      await Promise.all(matchPromises);
    }

    return requestId;
  } catch (error) {
    handleFirestoreError(error, 'create', 'requests');
  }
}

/**
 * 4. Fetching Unread Notifications
 */
export async function fetchUnreadNotifications(userId: string) {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('user_id', '==', userId),
      where('is_read', '==', false),
      orderBy('created_at', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, 'list', 'notifications');
  }
}

/**
 * 5. Update Notification Status
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { is_read: true });
  } catch (error) {
    handleFirestoreError(error, 'update', `notifications/${notificationId}`);
  }
}

/**
 * 7. Update User Availability
 */
export async function updateAvailability(userId: string, isAvailable: boolean, snoozeDays?: number) {
  try {
    const userRef = doc(db, 'users', userId);
    let snoozedUntil = null;
    
    if (!isAvailable && snoozeDays) {
      const date = new Date();
      date.setDate(date.getDate() + snoozeDays);
      snoozedUntil = date;
    }

    await updateDoc(userRef, {
      is_available: isAvailable,
      snoozed_until: snoozedUntil,
      updated_at: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, 'update', `users/${userId}`);
  }
}

/**
 * 7.1 Update Donor Profile
 */
export async function updateDonorProfile(userId: string, data: any) {
  try {
    const userRef = doc(db, 'users', userId);
    const normalizedData: any = {
      ...data,
      updated_at: serverTimestamp()
    };
    
    // Normalize fields for Firestore
    if (normalizedData.bloodGroup) {
      normalizedData.blood_group = normalizedData.bloodGroup;
      delete normalizedData.bloodGroup;
    }
    if (normalizedData.isAvailable !== undefined) {
      normalizedData.is_available = normalizedData.isAvailable;
      delete normalizedData.isAvailable;
    }
    if (normalizedData.id) delete normalizedData.id;

    await setDoc(userRef, normalizedData, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, 'update', `users/${userId}`);
  }
}

/**
 * 8. Get Donor Profile by Multiple Identifiers (UID, Email, or Phone)
 */
export async function getDonorProfile(firebaseUid: string, email?: string | null, phone?: string | null) {
  try {
    // 1. Try UID (direct doc access)
    const userRef = doc(db, 'users', firebaseUid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }

    // 2. Try Email
    if (email) {
      const qEmail = query(collection(db, 'users'), where('email', '==', email));
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        const docSnap = emailSnap.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
    }

    // 3. Try Phone
    if (phone) {
      const qPhone = query(collection(db, 'users'), where('phone', '==', phone));
      const phoneSnap = await getDocs(qPhone);
      if (!phoneSnap.empty) {
        const docSnap = phoneSnap.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, 'get', `users_lookup`);
    return null;
  }
}

/**
 * 8.1 Migrate Profile to New UID
 */
export async function migrateProfile(oldUid: string, newUid: string, profileData: any) {
  try {
    // 1. Delete old document if it exists and is different
    if (oldUid && oldUid !== newUid) {
      try {
        // We attempt to delete, but it might fail due to security rules
        // (if we don't own the old UID). We swallow the error to allow migration.
        await deleteDoc(doc(db, 'users', oldUid));
      } catch (delErr) {
        console.warn(`[Migration] Could not delete old doc ${oldUid}:`, delErr);
      }
    }
    
    // 2. Create/Update new document
    const userRef = doc(db, 'users', newUid);
    const updatedData: any = {
      ...profileData,
      firebase_uid: newUid,
      updated_at: serverTimestamp()
    };
    
    // Normalize fields to ensure validation rules pass
    if (updatedData.bloodGroup && !updatedData.blood_group) {
      updatedData.blood_group = updatedData.bloodGroup;
    }
    if (updatedData.isAvailable !== undefined && updatedData.is_available === undefined) {
      updatedData.is_available = updatedData.isAvailable;
    }
    
    // Ensure created_at exists
    if (!updatedData.created_at) {
      updatedData.created_at = serverTimestamp();
    }
    
    // Ensure required fields if they are missing
    if (!updatedData.name) updatedData.name = profileData.name || "Donor";
    if (!updatedData.phone) updatedData.phone = profileData.phone || "";
    if (!updatedData.blood_group) updatedData.blood_group = profileData.blood_group || "O+";
    if (!updatedData.state) updatedData.state = profileData.state || "Delhi";
    if (!updatedData.district) updatedData.district = profileData.district || "Central Delhi";

    // Remove individual field ID if present
    if (updatedData.id) delete updatedData.id;
    
    await setDoc(userRef, updatedData, { merge: true });
    return { id: newUid, ...updatedData };
  } catch (error) {
    handleFirestoreError(error, 'write', `migration_${oldUid}_to_${newUid}`);
  }
}

/**
 * Validates if a phone number is "real" (basic regex for Indian numbers)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  // Indian phone number regex: Starts with 6, 7, 8, or 9 and has 10 digits
  const re = /^[6-9]\d{9}$/;
  const cleanPhone = phone.replace(/\D/g, '');
  return re.test(cleanPhone.slice(-10));
}

/**
 * 9. Reveal donor contact and log it
 */
export async function revealContact(donorId: string, requestId: string) {
  try {
    // 1. Log the reveal
    const logsRef = collection(db, 'contacts_log');
    await addDoc(logsRef, {
      donor_id: donorId,
      request_id: requestId,
      revealed_at: serverTimestamp()
    });

    // 2. Increment search appearances
    const donorRef = doc(db, 'users', donorId);
    const donorSnap = await getDoc(donorRef);
    if (donorSnap.exists()) {
      const data = donorSnap.data();
      await updateDoc(donorRef, {
        search_appearances: (data.search_appearances || 0) + 1
      });
      return data.phone;
    }
  } catch (error) {
    handleFirestoreError(error, 'write', 'contacts_log');
  }
}

/**
 * 10. Fetch Global Stats for Dashboard
 */
export async function fetchGlobalStats() {
  const stats: any = {
    donors: [],
    requests: [],
    matches: [],
    counts: { donors: 0, requests: 0, matches: 0 }
  };

  try {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      stats.donors = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Dashboard: Failed to load users", e);
      handleFirestoreError(e, 'list', 'users_dashboard');
    }

    try {
      const requestsSnap = await getDocs(collection(db, 'requests'));
      stats.requests = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Dashboard: Failed to load requests", e);
      handleFirestoreError(e, 'list', 'requests_dashboard');
    }

    try {
      const matchesSnap = await getDocs(collection(db, 'matches'));
      stats.matches = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Dashboard: Failed to load matches", e);
      handleFirestoreError(e, 'list', 'matches_dashboard');
    }

    stats.counts = {
      donors: stats.donors.length,
      requests: stats.requests.length,
      matches: stats.matches.length
    };

    return stats;
  } catch (error) {
    handleFirestoreError(error, 'list', 'global_stats_final');
    return null;
  }
}

/**
 * 11. Admin: Delete User
 */
export async function deleteUser(userId: string) {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (e) {
    handleFirestoreError(e, 'delete', `users/${userId}`);
    return false;
  }
}

/**
 * 12. Admin: Delete Request
 */
export async function deleteRequest(requestId: string) {
  try {
    await deleteDoc(doc(db, 'requests', requestId));
    return true;
  } catch (e) {
    handleFirestoreError(e, 'delete', `requests/${requestId}`);
    return false;
  }
}

/**
 * 13. Admin: Toggle User Admin Status
 */
export async function toggleAdminStatus(userId: string, currentRole: string) {
  try {
    const newRole = currentRole === 'admin' ? 'donor' : 'admin';
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: newRole, updated_at: serverTimestamp() });

    const adminRef = doc(db, 'admin_users', userId);
    if (newRole === 'admin') {
      await setDoc(adminRef, { added_at: serverTimestamp(), role: 'admin' });
    } else {
      await deleteDoc(adminRef);
    }
    return true;
  } catch (e) {
    handleFirestoreError(e, 'update', `admin_users/${userId}`);
    return false;
  }
}
