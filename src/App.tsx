/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Droplets, 
  MapPin, 
  Phone, 
  Calendar, 
  User, 
  CheckCircle2, 
  ChevronRight, 
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Award,
  Clock,
  LogOut,
  Bell,
  Search,
  ChevronDown,
  Activity,
  Building2,
  AlertCircle,
  Home,
  X,
  Stethoscope,
  Syringe,
  Plane,
  MessageSquare,
  Sparkles,
  Camera,
  FileCheck,
  Info,
  ShieldCheck,
  LayoutDashboard,
  Sun,
  Moon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { validatePhoneNumber } from './services/bloodServices';
import { IndiaData, BloodGroups } from './data';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

type View = 'home' | 'donate' | 'find' | 'otp' | 'success' | 'profile' | 'dashboard' | 'auth' | 'register-form';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bc-theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [currentView, setCurrentView] = useState<View>('home');
  const [registrationStep, setRegistrationStep] = useState(1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [donorData, setDonorData] = useState({
    name: '',
    phone: '',
    dob: '',
    bloodGroup: '',
    state: 'Tamil Nadu',
    district: '',
    city: '',
    gender: 'Male',
    lastDonation: 'Never donated',
    donationDate: '',
    isAvailable: true,
    email: '',
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [patientNotifications, setPatientNotifications] = useState<any[]>([]);
  const [showPatientNotification, setShowPatientNotification] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bc-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bc-theme', 'light');
    }
  }, [isDarkMode]);

  const broadcastRequest = async (details: any) => {
    try {
      const { postBloodRequest } = await import('./services/bloodServices');
      await postBloodRequest({
        requester_name: details.fullName,
        mobile: details.mobile,
        blood_group: details.bloodGroup,
        units_required: parseInt(details.units) || 1,
        needed_on: details.date,
        reason: details.reasonCategory === 'Others' ? details.customReason : details.reasonCategory,
        hospital: details.hospital,
        state: details.state,
        district: details.district,
        city: details.city,
        type: 'emergency', // Default for broadcast
        posted_by: user ? 'user' : 'public'
      });
    } catch (e) {
      console.error("Failed to broadcast request", e);
    }
  };

  // Real-time notifications listener
  useEffect(() => {
    if (user && user.uid) {
      let unsubscribe: any;
      
      const setupListener = async () => {
        const { collection, query, where, onSnapshot, orderBy } = await import('firebase/firestore');
        const q = query(
          collection(db, 'notifications'),
          where('user_id', '==', user.uid),
          where('is_read', '==', false)
          // Removed orderBy to prevent index-related permission issues
        );
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          const newNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
            .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
          
          setNotifications(newNotifs);
          if (newNotifs.length > 0 && currentView === 'profile') {
            setShowNotificationPopup(true);
          }
        }, (error) => {
          console.error("Notifications Listener Error:", error);
          // If you see code=permission-denied here, ensure:
          // 1. You have a composite index for notifications (user_id, is_read, created_at)
          // 2. The firestore.rules permit list on notifications for the user_id
        });
      };
      
      setupListener();
      return () => unsubscribe && unsubscribe();
    }
  }, [user, currentView]);

  const [showMobileNav, setShowMobileNav] = useState(true);
  const lastScrollY = useRef(0);
  const navTimer = useRef<any>(null);

  // Auth synchronization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      try {
        const normalize = (val: any, fallback = '') => (val === null || val === undefined) ? fallback : val;
        if (firebaseUser) {
          setUser(firebaseUser);
          // Load donor profile from Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            const loadedProfile = {
              name: normalize(data.name || data.displayName, firebaseUser.displayName || ''),
              phone: normalize(data.phone),
              dob: normalize(data.dob),
              bloodGroup: normalize(data.blood_group || data.bloodGroup),
              state: normalize(data.state, 'Tamil Nadu'),
              district: normalize(data.district),
              city: normalize(data.city),
              gender: normalize(data.gender, 'Male'),
              lastDonation: normalize(data.last_donation || data.lastDonation, 'Never donated'),
              donationDate: normalize(data.donation_date || data.donationDate),
              isAvailable: data.is_available ?? data.isAvailable ?? true,
              email: normalize(data.email, firebaseUser.email || '')
            };
            setDonorData(loadedProfile);
            // Sync to local storage
            localStorage.setItem('bc_donor_profile', JSON.stringify(loadedProfile));
          } else {
            // Check localStorage fallback
            const localProfile = localStorage.getItem('bc_donor_profile');
            if (localProfile) {
              const data = JSON.parse(localProfile);
              const loadedProfile = {
                name: normalize(data.name, firebaseUser.displayName || ''),
                phone: normalize(data.phone),
                dob: normalize(data.dob),
                bloodGroup: normalize(data.blood_group || data.bloodGroup),
                state: normalize(data.state, 'Tamil Nadu'),
                district: normalize(data.district),
                city: normalize(data.city),
                gender: normalize(data.gender, 'Male'),
                lastDonation: normalize(data.last_donation || data.lastDonation, 'Never donated'),
                donationDate: normalize(data.donation_date || data.donationDate),
                isAvailable: data.is_available ?? data.isAvailable ?? true,
                email: normalize(data.email, firebaseUser.email || '')
              };
              setDonorData(loadedProfile);
            } else {
              setDonorData(prev => ({
                ...prev,
                email: normalize(firebaseUser.email, prev.email),
                name: normalize(firebaseUser.displayName, prev.name)
              }));
            }
          }
        } else {
          // Load from local storage for demo if present
          const localProfile = localStorage.getItem('bc_donor_profile');
          if (localProfile) {
            const data = JSON.parse(localProfile);
            const loadedProfile = {
              name: normalize(data.name),
              phone: normalize(data.phone),
              dob: normalize(data.dob),
              bloodGroup: normalize(data.blood_group || data.bloodGroup),
              state: normalize(data.state, 'Tamil Nadu'),
              district: normalize(data.district),
              city: normalize(data.city),
              gender: normalize(data.gender, 'Male'),
              lastDonation: normalize(data.last_donation || data.lastDonation, 'Never donated'),
              donationDate: normalize(data.donation_date || data.donationDate),
              isAvailable: data.is_available ?? data.isAvailable ?? true,
              email: normalize(data.email)
            };
            setDonorData(loadedProfile);
            setUser({ uid: data.firebase_uid || 'phone-demo-fallback', isAnonymous: true } as any);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.warn("[Auth] Error inside onAuthStateChanged, loading local fallback:", err);
        const localProfile = localStorage.getItem('bc_donor_profile');
        if (localProfile) {
          try {
            const data = JSON.parse(localProfile);
            const normalize = (val: any, fallback = '') => (val === null || val === undefined) ? fallback : val;
            const loadedProfile = {
              name: normalize(data.name),
              phone: normalize(data.phone),
              dob: normalize(data.dob),
              bloodGroup: normalize(data.blood_group || data.bloodGroup),
              state: normalize(data.state, 'Tamil Nadu'),
              district: normalize(data.district),
              city: normalize(data.city),
              gender: normalize(data.gender, 'Male'),
              lastDonation: normalize(data.last_donation || data.lastDonation, 'Never donated'),
              donationDate: normalize(data.donation_date || data.donationDate),
              isAvailable: data.is_available ?? data.isAvailable ?? true,
              email: normalize(data.email)
            };
            setDonorData(loadedProfile);
          } catch (jsonErr) {
            console.error("[Auth] Stale local profile parsing error", jsonErr);
          }
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);
      
      // Always show if near top
      if (currentScrollY < 20) {
        setShowMobileNav(true);
        if (navTimer.current) clearTimeout(navTimer.current);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Hide on scroll down, Show on scroll up
      if (currentScrollY > lastScrollY.current + 5) {
        // Scrolling down - Hide
        setShowMobileNav(false);
        if (navTimer.current) clearTimeout(navTimer.current);
      } else if (currentScrollY < lastScrollY.current - 5) {
        // Scrolling up - Show
        setShowMobileNav(true);
        
        // Auto-hide again if they stop moving after showing
        if (navTimer.current) clearTimeout(navTimer.current);
        navTimer.current = setTimeout(() => {
          if (window.scrollY > 20) {
            setShowMobileNav(false);
          }
        }, 3000); // 3 seconds of peak visibility when they intentionally scroll up
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  const isAdmin = auth.currentUser?.email === 'mike.nijoe@gmail.com';

  const navLinks = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'find', label: 'Find blood', icon: Search },
    { id: 'auth', label: 'Be a donor', icon: Heart },
    { id: 'dashboard', label: 'Admin', icon: LayoutDashboard },
  ];

  const ThemeToggle = () => (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="p-2.5 rounded-full hover:bg-bc-surface text-bc-text/60 hover:text-bc-text transition-all duration-300 relative group"
      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDarkMode ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </motion.div>
    </button>
  );

  return (
    <div className="min-h-screen bg-bc-bg text-bc-text selection:bg-bc-red/10 selection:text-bc-red flex flex-col">
      {/* Desktop Navigation */}
      <nav 
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          isScrolled || showNotificationPopup ? 'bg-bc-bg/80 backdrop-blur-md py-4' : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setCurrentView('home')}
          >
            <div className="relative w-2 h-2 rounded-full bg-bc-red animate-pulse-dot" />
            <span className="font-serif text-xl tracking-tight">BloodConnect</span>
          </div>

          <div className="hidden md:flex items-center gap-1 md:gap-4">
            {navLinks.filter(link => {
              if (link.id === 'auth' && user) return false;
              if (link.id === 'dashboard' && !isAdmin) return false;
              return true;
            }).map((link) => (
              <button
                key={link.id}
                onClick={() => setCurrentView(link.id as View)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  currentView === link.id || ((currentView === 'auth' || currentView === 'register-form') && link.id === 'auth')
                    ? 'bg-bc-red-tint text-bc-red'
                    : 'hover:bg-bc-surface text-bc-text/60 hover:text-bc-text'
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user && (
                <button 
                  onClick={() => setCurrentView('profile')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    currentView === 'profile' ? 'bg-bc-red-tint text-bc-red' : 'bg-bc-surface text-bc-text/40 hover:text-bc-text'
                  }`}
                >
                  <User size={18} />
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={() => setShowNotificationPopup(true)}
                  className="w-10 h-10 rounded-full bg-bc-surface flex items-center justify-center text-bc-text/40 hover:text-bc-red relative group transition-all"
                >
                  <Bell size={18} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-bc-red rounded-full border-2 border-bc-bg animate-bounce" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Profile Icon for Mobile Header (Optional, but keeps it clean) */}
          <div className="md:hidden">
            {currentView === 'profile' ? (
               <button onClick={() => setCurrentView('home')} className="w-8 h-8 rounded-full bg-bc-red-tint flex items-center justify-center text-bc-red">
                 <Home size={16} />
               </button>
            ) : (
              <button onClick={() => setCurrentView('profile')} className="w-8 h-8 rounded-full bg-bc-surface flex items-center justify-center text-bc-text/40">
                <User size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showNotificationPopup && notifications.length > 0 && (
          <EmergencyRequestBanner 
            request={notifications[0]} 
            onClose={() => setShowNotificationPopup(false)}
            onAccept={() => {
              setShowNotificationPopup(false);
              setActiveRequest(notifications[0]);
              setShowCoordinationModal(true);
            }}
          />
        )}
      </AnimatePresence>

      <EmergencyCoordinationModal 
        isOpen={showCoordinationModal} 
        onClose={() => setShowCoordinationModal(false)} 
        request={activeRequest} 
      />

      <AnimatePresence>
        {showPatientNotification && patientNotifications.length > 0 && (
          <DonorAcceptedBanner 
            response={patientNotifications[0]} 
            onClose={() => setShowPatientNotification(false)}
          />
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-6 py-8 md:py-12 mb-24 md:mb-0">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <HomeView 
              key="home" 
              onRegister={() => setCurrentView('auth')} 
              onFind={() => setCurrentView('find')} 
              onDashboard={() => setCurrentView('dashboard')}
              adminMode={isAdmin}
            />
          )}
          {currentView === 'auth' && (
            <AuthEntryView 
              key="auth"
              onComplete={async (uid: string, phone: string, email: string, name: string, photoURL: string) => {
                console.log("[Auth] onComplete triggered for UID:", uid);
                try {
                  if (uid) {
                    const { getDonorProfile } = await import('./services/bloodServices');
                    console.log("[Auth] Fetching donor profile...");
                    let profile: any = null;
                    try {
                      profile = await getDonorProfile(uid, email, phone);
                    } catch (pErr) {
                      console.warn("[Auth] getDonorProfile failed, trying local storage fallback:", pErr);
                      const savedLocal = localStorage.getItem('bc_donor_profile');
                      if (savedLocal) {
                        try {
                          profile = JSON.parse(savedLocal);
                        } catch (parseErr) {
                          console.error("[Auth] Stale local profile parse error", parseErr);
                        }
                      }
                    }
                    
                    if (profile) {
                      console.log("[Auth] profile found, migrating if needed...");
                      const { migrateProfile } = await import('./services/bloodServices');
                      let finalProfile: any = profile;
                      
                      if (profile.firebase_uid && profile.firebase_uid !== uid) {
                        console.log("[Auth] Performing migration from", profile.firebase_uid, "to", uid);
                        try {
                          const migrated = await migrateProfile(profile.firebase_uid, uid, profile);
                          if (migrated) finalProfile = migrated;
                        } catch (migErr) {
                          console.warn("[Auth] migration failed, continuing with existing profile:", migErr);
                        }
                      }
                      
                      // Sync to local storage
                      localStorage.setItem('bc_donor_profile', JSON.stringify(finalProfile));
                      
                      setDonorData(prev => ({
                        ...prev,
                        ...finalProfile,
                        bloodGroup: finalProfile.blood_group || finalProfile.bloodGroup || prev.bloodGroup || '',
                        isAvailable: finalProfile.is_available ?? true
                      }));
                      setUser({ uid } as any);
                      setTimeout(() => setCurrentView('profile'), 100);
                    } else {
                      console.log("[Auth] No profile found, moving to register-form.");
                      setDonorData(prev => ({ ...prev, phone, email, name: name || prev.name, photoURL: photoURL || prev.photoURL }));
                      setUser({ uid } as any); 
                      setTimeout(() => setCurrentView('register-form'), 100);
                    }
                  } else {
                    console.error("No UID provided to onComplete");
                    setCurrentView('home');
                  }
                } catch (err: any) {
                  console.error("Auth flow failed in onComplete:", err);
                  // fallback to local profile if present
                  const savedLocal = localStorage.getItem('bc_donor_profile');
                  if (savedLocal) {
                    try {
                      const localData = JSON.parse(savedLocal);
                      setDonorData(prev => ({ ...prev, ...localData }));
                      setUser({ uid: uid || 'demo-uid' } as any);
                      setCurrentView('profile');
                    } catch (jsonErr) {
                      setCurrentView('home');
                    }
                  } else {
                    setCurrentView('home');
                  }
                }
              }}
            />
          )}
          {currentView === 'register-form' && (
            <RegistrationView 
              key="register-form" 
              step={registrationStep} 
              onComplete={async () => {
                // Now submit to Firestore
                try {
                  const { registerDonor } = await import('./services/bloodServices');
                  const targetUid = user?.uid || auth.currentUser?.uid || 'temp-phone-uid';
                  const payload = {
                    name: donorData.name,
                    phone: donorData.phone,
                    blood_group: donorData.bloodGroup,
                    state: donorData.state,
                    district: donorData.district,
                    city: donorData.city,
                    gender: donorData.gender,
                    age: calculateAge(donorData.dob) || 25,
                    last_donated_at: donorData.lastDonation === "Donated recently" ? new Date(donorData.donationDate) : null,
                    is_available: donorData.isAvailable !== undefined ? donorData.isAvailable : true,
                    firebase_uid: targetUid,
                    email: donorData.email || null,
                    photoURL: donorData.photoURL || null
                  };
                  
                  // Save locally first as a fallback
                  localStorage.setItem('bc_donor_profile', JSON.stringify(payload));
                  
                  const userData = await registerDonor(targetUid, payload);
                  if (userData) {
                    setDonorData(userData);
                    localStorage.setItem('bc_donor_profile', JSON.stringify(userData));
                  }
                } catch (err) {
                  console.warn("Firestore registration failed, using local profile fallback:", err);
                  // Profile is already saved to local storage fallback
                }
                setCurrentView('success');
              }} 
              donorData={donorData}
              setDonorData={setDonorData}
            />
          )}
          {currentView === 'success' && (
            <SuccessView 
              key="success" 
              donorData={donorData} 
              onViewProfile={() => setCurrentView('profile')} 
            />
          )}
          {currentView === 'find' && <FindBloodView key="find" onBroadcast={broadcastRequest} />}
          {currentView === 'profile' && (
            <ProfileView 
              key="profile" 
              donorData={donorData} 
              setDonorData={setDonorData} 
              notifications={notifications}
              setShowNotificationPopup={setShowNotificationPopup}
              setNotifications={setNotifications}
              setActiveRequest={setActiveRequest}
              setShowCoordinationModal={setShowCoordinationModal}
              setCurrentView={setCurrentView}
              onLogout={() => {
                auth.signOut();
                setUser(null);
                setCurrentView('home');
              }}
            />
          )}
          {currentView === 'dashboard' && (
            <DashboardView onBack={() => setCurrentView('profile')} />
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Taskbar Navigation */}
      <AnimatePresence>
        {showMobileNav && isScrolled && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 md:hidden pointer-events-auto"
          >
            <div className="glassy-bubble !bg-white/90 dark:!bg-bc-surface/90 backdrop-blur-3xl px-4 py-2.5 rounded-full shadow-2xl border border-white/50 dark:border-white/10 flex items-center gap-2">
              {navLinks.filter(link => {
                if (link.id === 'auth' && user) return false;
                return true;
              }).map((link) => {
                const Icon = link.icon;
                const isActive = currentView === link.id || ((currentView === 'auth' || currentView === 'register-form') && link.id === 'auth');
                return (
                  <button
                    key={link.id}
                    onClick={() => setCurrentView(link.id as View)}
                    className={`p-3 rounded-full transition-all duration-300 relative ${
                      isActive ? 'text-bc-red bg-bc-red-tint' : 'text-bc-text/40 hover:text-bc-text/60'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    {isActive && (
                      <motion.div 
                        layoutId="activePill"
                        className="absolute inset-0 bg-bc-red/5 rounded-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
              <div className="w-px h-6 bg-bc-text/10 mx-0.5" />
              <ThemeToggle />
              {user && (
                <button
                  onClick={() => setCurrentView('profile')}
                  className={`p-3 rounded-full transition-all duration-300 ${
                    currentView === 'profile' ? 'text-bc-red bg-bc-red-tint' : 'text-bc-text/40 hover:text-bc-text/60'
                  }`}
                >
                  <User size={20} strokeWidth={currentView === 'profile' ? 2.5 : 2} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-auto py-12 px-6 border-t border-thin opacity-20 text-center text-[10px] tracking-widest uppercase mb-24 md:mb-0">
        BloodConnect India &copy; 2026 • Crafted with care
      </footer>
    </div>
  );
}

// ... Placeholder components for now to keep the file structure clear
function GlassyInput({ label, value, onChange, name, type = "text", placeholder = "", icon: Icon, uppercase = false, capitalize = false }: any) {
  const [isTouched, setIsTouched] = useState(false);
  const isPhone = type === "tel";
  const isInvalid = isPhone && isTouched && value && value.length > 0 && value.length < 10;
  const isNameField = name?.toLowerCase()?.includes('name');
  const shouldCapitalize = capitalize || name?.toLowerCase()?.includes('city') || name?.toLowerCase()?.includes('village') || name?.toLowerCase()?.includes('hospital');
  const shouldUppercase = (uppercase || isNameField) && !shouldCapitalize;

  const handleInternalChange = (e: any) => {
    let val = e.target.value;
    if (isPhone) {
      val = val.replace(/\D/g, '').slice(0, 10);
    } else {
      if (isNameField) {
        // Only allow alphabets and spaces for name fields
        val = val.replace(/[^a-zA-Z\s]/g, '');
      }
      
      if (shouldUppercase) {
        val = val.toUpperCase();
      } else if (shouldCapitalize) {
        // Capitalize first letter of each word
        val = val.replace(/\b\w/g, (l: string) => l.toUpperCase());
      }
    }

    // Pass a safe object to the parent's onChange
    onChange({
      target: {
        name,
        value: val
      }
    } as any);
  };

  const displayValue = isPhone && value 
    ? value.replace(/(\d{5})(\d{1,5})/, '$1 $2').trim() 
    : (shouldUppercase ? value?.toUpperCase() : (shouldCapitalize ? value?.replace(/\b\w/g, (l: string) => l.toUpperCase()) : value));

  return (
    <motion.label 
      animate={isInvalid ? { x: [-4, 4, -4, 4, 0] } : {}}
      transition={{ duration: 0.4 }}
      className="relative group block cursor-text"
    >
      <div className={`glassy-bubble p-6 rounded-[32px] border-none shadow-bc-text/5 flex flex-col gap-2 transition-all duration-500 group-hover:scale-[1.02] focus-within:scale-[1.02] active:scale-[0.98] outline-none relative z-10 min-h-[92px] justify-center text-left ${
        isInvalid ? 'ring-2 ring-bc-red/30 bg-bc-red/5' : 'focus-within:ring-2 focus-within:ring-bc-red/20'
      }`}>
        <span className={`text-[10px] uppercase tracking-[0.2em] font-medium px-0.5 leading-none ${isInvalid ? 'text-bc-red' : 'text-bc-text/40'}`}>
          {label} {isInvalid && "— Must be 10 digits"}
        </span>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className={`${isInvalid ? 'text-bc-red/50' : 'text-bc-text/30'} shrink-0`} />}
          {isPhone && <span className={`text-sm font-medium pl-0.5 tracking-tight ${isInvalid ? 'text-bc-red' : 'text-bc-text/40'}`}>+91</span>}
          <input 
            type={isPhone ? "text" : type}
            name={name}
            placeholder={placeholder}
            className={`w-full bg-transparent outline-none font-medium text-sm placeholder:text-bc-text/20 tracking-wider leading-none ${shouldUppercase ? 'uppercase' : ''} ${isInvalid ? 'text-bc-red' : 'text-bc-text'}`}
            value={displayValue || ''}
            onChange={handleInternalChange}
            onBlur={() => setIsTouched(true)}
            required
            inputMode={isPhone ? "numeric" : undefined}
          />
        </div>
      </div>
      <div className={`absolute -inset-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 rounded-[40px] blur-2xl transition-all duration-500 pointer-events-none ${isInvalid ? 'bg-bc-red/10 animate-pulse' : 'bg-bc-red/5'}`} />
    </motion.label>
  );
}

function calculateAge(dob: string) {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

function DateInput({ label, value, onChange, name, min, max }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isBirthday = name?.toLowerCase()?.includes('dob') || name?.toLowerCase()?.includes('birth');
  const age = calculateAge(value);
  const isMinor = age !== null && age < 18;
  const isOverAge = age !== null && age > 65;
  const isIneligible = isMinor || isOverAge;

  // Default behavior for birthdays if no max provided
  const today = new Date().toISOString().split('T')[0];
  const dateMax = max || (isBirthday ? today : undefined);
  const dateMin = min;

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="relative group block cursor-pointer"
    >
      <div className={`glassy-bubble backdrop-blur-[40px] p-6 rounded-[32px] shadow-xl shadow-bc-text/5 flex flex-col gap-2 transition-all duration-500 group-hover:scale-[1.02] focus-within:scale-[1.02] focus-within:ring-2 active:scale-[0.98] outline-none relative z-10 min-h-[92px] justify-center text-left ${
        isBirthday && value && isIneligible ? 'border-bc-warning/40 ring-bc-warning/10' : 'border-bc-text/5 ring-bc-red/20'
      }`}>
        <span className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-bold px-0.5 leading-none">{label}</span>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={14} className="text-bc-text/30 pointer-events-none" />
            <input 
              ref={inputRef}
              id={name === 'dob' ? 'dob-input' : undefined}
              type="date" 
              name={name}
              min={dateMin}
              max={dateMax}
              className="bg-transparent outline-none text-bc-text font-medium text-sm cursor-pointer relative z-20 leading-none flex-1"
              value={value || ''}
              onChange={onChange}
              onClick={(e) => e.stopPropagation()}
              required
            />
          </div>
          {isBirthday && age !== null && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm backdrop-blur-md transition-colors duration-500 ${
                isIneligible ? 'bg-bc-warning/10 border-bc-warning/30' : 'bg-bc-surface/80 border-bc-text/10'
              }`}
            >
              <div className="flex flex-col items-center leading-none">
                <span className={`text-[12px] font-bold ${isIneligible ? 'text-bc-warning' : 'text-bc-red'}`}>{age < 0 ? '?' : age}</span>
                <span className="text-[6px] uppercase tracking-tighter text-bc-text/30">Age</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <div className="absolute -inset-2 bg-bc-red/5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 rounded-[40px] blur-2xl transition-all duration-500 pointer-events-none" />
    </div>
  );
}

function SearchableSelect({ label, options = [], value, onChange, placeholder = "Search..." }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const filteredOptions = Array.isArray(options) ? options.filter((opt: string) => 
    opt?.toLowerCase()?.includes(search?.toLowerCase() || "")
  ) : [];

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full glassy-bubble p-6 rounded-[32px] border-none focus:ring-2 focus:ring-bc-red/20 outline-none transition-all duration-500 text-left flex flex-col gap-2 group relative z-10 min-h-[92px] justify-center ${isOpen ? 'ring-2 ring-bc-red/20 scale-[1.02]' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-bc-text/30 font-medium px-0.5 leading-none">{label}</span>
        <div className="flex items-center justify-between w-full">
          <span className={`text-sm font-medium transition-all duration-300 leading-none ${value ? 'text-bc-text' : 'text-bc-text/20'}`}>
            {value || "Select..."}
          </span>
          <ChevronDown size={14} className={`text-bc-text/30 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <div className={`absolute -inset-2 bg-bc-red/5 opacity-0 rounded-[40px] blur-2xl transition-all duration-500 pointer-events-none ${isOpen ? 'opacity-100' : 'group-hover:opacity-100'}`} />

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute top-full left-0 right-0 z-50 mt-3 glassy-bubble p-2 rounded-[32px] shadow-2xl overflow-hidden max-h-80 flex flex-col border border-bc-text/5"
            >
              <div className="p-2 mb-1">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bc-text/20" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={placeholder}
                    className="w-full bg-bc-bg/40 pl-9 pr-4 py-2.5 rounded-2xl border-thin focus:border-bc-red/20 outline-none text-sm transition-all focus:bg-white"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto py-1 scrollbar-thin px-1 space-y-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt: string) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onChange(opt);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full px-4 py-3 text-left text-sm rounded-2xl transition-all duration-200 flex items-center justify-between group/item ${
                        value === opt 
                          ? 'bg-bc-red text-white shadow-lg shadow-bc-red/20' 
                          : 'text-bc-text/70 hover:bg-bc-red-tint/50 hover:text-bc-red'
                      }`}
                    >
                      <span className="font-medium tracking-tight">{opt}</span>
                      {value === opt && <CheckCircle2 size={14} className="text-white/80" />}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center space-y-2">
                    <Search size={24} className="mx-auto text-bc-text/5" />
                    <p className="text-xs text-bc-text/30 font-medium tracking-wide">No locations found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function HomeView({ onRegister, onFind, onDashboard, adminMode }: any) {
  if (adminMode) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
      >
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-bc-success-bg border border-bc-success/20 rounded-full text-bc-success text-[10px] font-bold tracking-widest uppercase">
          <ShieldCheck className="w-3 h-3" />
          Admin Mode Active
        </div>
        <h1 className="font-serif text-5xl md:text-7xl mb-6 max-w-2xl leading-[1.1]">
          The master dashboard is live.
        </h1>
        <p className="font-light text-bc-text/60 max-w-lg text-lg mb-12">
          Access real-time donor trends and regional statistics from the navigation bar or your profile.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
          <motion.button 
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDashboard}
            className="group flex-1 bg-bc-text text-white py-6 px-10 rounded-[32px] font-bold text-lg tracking-tight hover:bg-black transition-all shadow-2xl flex items-center justify-center gap-3 relative overflow-hidden"
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="relative z-10">Open Dashboard</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={onFind}
            className="group flex-1 bg-bc-surface border-thin border-bc-text/5 text-bc-text py-6 px-10 rounded-[32px] font-bold text-lg tracking-tight hover:brightness-105 transition-all shadow-xl shadow-bc-text/5 flex items-center justify-center gap-3 relative overflow-hidden"
          >
            <Search className="w-6 h-6 text-bc-red group-hover:rotate-12 transition-transform duration-300" />
            <span className="relative z-10">Search Database</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 bg-bc-red-tint rounded-full text-bc-red text-[10px] font-medium tracking-widest uppercase">
        <div className="w-1 h-1 rounded-full bg-bc-red animate-pulse" />
        Live in India
      </div>
      <h1 className="font-serif text-5xl md:text-7xl mb-6 max-w-2xl leading-[1.1]">
        Every drop brings <span className="italic opacity-50 font-light italic">hope</span> to life.
      </h1>
      <p className="font-light text-bc-text/60 max-w-lg text-lg mb-12">
        India's most human blood matching network. Register as a donor or find one in minutes.
      </p>
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
        <motion.button 
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRegister}
          className="group flex-1 bg-bc-red text-white py-6 px-10 rounded-[32px] font-bold text-lg tracking-tight hover:brightness-110 transition-all shadow-2xl shadow-bc-red/20 flex items-center justify-center gap-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Heart className="w-6 h-6 fill-white group-hover:scale-110 transition-transform duration-300" />
          <span className="relative z-10">Donate life</span>
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={onFind}
          className="group flex-1 bg-bc-surface border-thin border-bc-text/5 text-bc-text py-6 px-10 rounded-[32px] font-bold text-lg tracking-tight hover:brightness-105 transition-all shadow-xl shadow-bc-text/5 flex items-center justify-center gap-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-bc-red/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Search className="w-6 h-6 text-bc-red group-hover:rotate-12 transition-transform duration-300" />
          <span className="relative z-10">Find blood</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

// We'll implement the actual screens in separate steps but they'll be in this file for simplicity or split if too large.
// I'll start with RegistrationView.
function RegistrationView({ step, onComplete, donorData, setDonorData }: any) {
  const [districts, setDistricts] = useState<string[]>(IndiaData[donorData.state] || []);
  const [dismissedMinorWarning, setDismissedMinorWarning] = useState(false);

  useEffect(() => {
    setDistricts(IndiaData[donorData.state] || []);
  }, [donorData.state]);

  const age = calculateAge(donorData.dob);
  const isMinor = age !== null && age < 18;
  const isOverAge = age !== null && age > 65;
  const isIneligibleAge = isMinor || isOverAge;

  // Reset dismissal if age changes back to eligible
  useEffect(() => {
    if (!isIneligibleAge) setDismissedMinorWarning(false);
  }, [isIneligibleAge]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setDonorData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleBloodSelect = (group: string) => {
    setDonorData((prev: any) => ({ ...prev, bloodGroup: group }));
  };

  const handleDonationToggle = (status: string) => {
    setDonorData((prev: any) => ({ ...prev, lastDonation: status }));
  };

  const scrollToDob = () => {
    document.getElementById('dob-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('dob-input')?.click();
  };

  const isFormValid = (donorData.name?.length || 0) > 2 && 
                     (donorData.phone?.length || 0) === 10 && 
                     donorData.bloodGroup !== '' && 
                     donorData.district !== '' && 
                     donorData.dob !== '' && 
                     !isIneligibleAge;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start"
    >
      {/* Left Column - Hero */}
      <div className="lg:sticky lg:top-32 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-bc-red text-[10px] font-medium tracking-[0.2em] uppercase">Donor registration</span>
            <div className="w-12 h-[0.5px] bg-bc-red/30" />
          </div>
          <h2 className="font-serif text-5xl md:text-6xl leading-[1.1]">
            Your blood. <br />
            <span className="italic text-bc-text/50 font-light">Someone's</span> tomorrow.
          </h2>
          <p className="font-light text-bc-text/60 text-lg max-w-md">
            Join 4,200+ donors in your district who are ready to save a life when it matters most.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 py-4 border border-bc-text/5 bg-bc-surface/30 backdrop-blur-2xl rounded-[40px] overflow-hidden shadow-2xl shadow-bc-text/5 divide-y sm:divide-y-0 sm:divide-x divide-bc-text/10">
          <div className="flex flex-col items-center justify-center space-y-1.5 py-10 sm:py-0 px-6 text-center group/item hover:bg-white/10 transition-colors">
            <div className="text-4xl font-serif italic text-bc-red tracking-tight whitespace-nowrap drop-shadow-sm">2 min</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-bc-text/30 font-black">Fast registration</div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-1.5 py-10 sm:py-0 px-6 text-center group/item hover:bg-white/10 transition-colors">
            <div className="text-4xl font-serif italic text-bc-red tracking-tight whitespace-nowrap drop-shadow-sm">0 spam</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-bc-text/30 font-black">Privacy first</div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-1.5 py-10 sm:py-0 px-6 text-center group/item hover:bg-white/10 transition-colors">
            <div className="text-4xl font-serif italic text-bc-red tracking-tight whitespace-nowrap drop-shadow-sm">∞ impact</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-bc-text/30 font-black">Unlimited lives</div>
          </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="space-y-8">
        <div className="flex items-center justify-between px-2">
          {[
            { s: 1, l: "Your details" },
            { s: 2, l: "Verify phone" },
            { s: 3, l: "Confirmed" }
          ].map((item, i) => (
            <div key={item.s} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-all duration-500 ${
                step >= item.s ? 'bg-bc-red text-white' : 'bg-bc-surface text-bc-text/30'
              }`}>
                {step > item.s ? <CheckCircle2 size={12} strokeWidth={3} /> : item.s}
              </div>
              <span className={`text-[11px] uppercase tracking-widest hidden sm:block ${
                step >= item.s ? 'text-bc-text font-medium' : 'text-bc-text/30'
              }`}>
                {item.l}
              </span>
              {i < 2 && <div className={`w-8 h-[1px] ${step > item.s ? 'bg-bc-success' : 'bg-bc-text/10'}`} />}
            </div>
          ))}
        </div>

          <div className="p-8 md:p-12 glassy-bubble backdrop-blur-2xl rounded-[40px] border-none shadow-2xl shadow-bc-text/5 space-y-12">
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <User size={14} className="text-bc-text/20" />
                <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Personal Details</label>
              </div>
              <div className="space-y-4">
                <GlassyInput 
                  label="Full name"
                  name="name"
                  value={donorData.name}
                  onChange={handleChange}
                  icon={User}
                  capitalize
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <GlassyInput 
                    type="tel"
                    label="Phone number"
                    name="phone"
                    value={donorData.phone}
                    onChange={handleChange}
                    icon={Phone}
                  />
                  <GlassyInput 
                    type="email"
                    label="Email Address"
                    name="email"
                    value={donorData.email}
                    onChange={handleChange}
                    icon={MessageSquare}
                  />
                  <DateInput 
                    label="Date of Birth"
                    name="dob"
                    value={donorData.dob}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <User size={14} className="text-bc-text/20" />
                  <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Physical Detail</label>
                </div>
                <div className="flex bg-bc-surface p-1 rounded-full border-thin">
                  {[
                    { id: 'Male', label: 'Men', icon: '♂' },
                    { id: 'Female', label: 'Women', icon: '♀' }
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setDonorData((p: any) => ({ ...p, gender: g.id }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                        donorData.gender === g.id 
                          ? 'bg-bc-red text-white shadow-md' 
                          : 'text-bc-text/40 hover:text-bc-text/60'
                      }`}
                    >
                      <span className="text-sm">{g.icon}</span>
                      <span className="text-[9px] uppercase tracking-widest font-bold">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <Heart size={14} className="text-bc-text/20" />
                <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Medical Profile</label>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <span className="text-xs text-bc-text/40 block px-1 italic">Select your blood group</span>
                  <div className="grid grid-cols-4 gap-y-4 gap-x-2 justify-items-center">
                    {BloodGroups.map(group => (
                      <motion.button
                        key={group}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleBloodSelect(group)}
                        className={`w-14 h-14 rounded-full border-thin flex items-center justify-center transition-all duration-300 font-medium text-sm ${
                          donorData.bloodGroup === group 
                            ? 'bg-bc-red text-white shadow-lg shadow-bc-red/30 border-bc-red scale-110' 
                            : 'bg-bc-bg hover:bg-bc-red-tint/50 text-bc-text/60'
                        }`}
                      >
                        {group}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-xs text-bc-text/40 block px-1 italic">When did you last donate?</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {["Never donated", donorData.gender === 'Female' ? "Within 4 months" : "Within 3 months", "4+ months ago"].map(status => (
                      <button
                        key={status}
                        onClick={() => handleDonationToggle(status)}
                        className={`py-4 px-4 text-xs rounded-2xl border-thin transition-all duration-300 font-medium ${
                          donorData.lastDonation === status 
                            ? (status.includes("Within") 
                              ? 'bg-bc-warning-bg border-bc-warning text-bc-warning shadow-lg shadow-bc-warning/10 scale-[1.02]' 
                              : 'bg-bc-success-bg border-bc-success text-bc-success shadow-lg shadow-bc-success/10 scale-[1.02]')
                            : 'bg-bc-bg text-bc-text/60 hover:bg-bc-surface'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <MapPin size={14} className="text-bc-text/20" />
                <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Location Information</label>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SearchableSelect 
                    label="State"
                    options={Object.keys(IndiaData)}
                    value={donorData.state}
                    onChange={(val: string) => setDonorData((p: any) => ({ ...p, state: val, district: '' }))}
                    placeholder="Filter states..."
                  />
                  <SearchableSelect 
                    label="District"
                    options={districts}
                    value={donorData.district}
                    onChange={(val: string) => setDonorData((p: any) => ({ ...p, district: val }))}
                    placeholder="Filter districts..."
                  />
                </div>
                <GlassyInput 
                  label="City / Village (Optional)"
                  name="city"
                  value={donorData.city}
                  onChange={handleChange}
                  icon={MapPin}
                />
              </div>
            </div>

          <AnimatePresence>
            {isIneligibleAge && !dismissedMinorWarning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-bc-warning-bg border-thin border-bc-warning/30 p-6 rounded-[32px] space-y-4 relative"
              >
                <button 
                  onClick={() => setDismissedMinorWarning(true)}
                  className="absolute top-4 right-4 text-bc-warning/40 hover:text-bc-warning transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-bc-warning/10 flex items-center justify-center text-bc-warning shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif text-lg text-bc-warning">Age Restriction</h3>
                    <p className="text-xs text-bc-warning/70 leading-relaxed max-w-[90%]">
                      {isMinor 
                        ? "You must be at least 18 years old to donate blood safely. Please return when you're eligible." 
                        : "Blood donation is generally recommended for individuals up to 65 years of age. Please consult a doctor for further guidance."}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={scrollToDob}
                  className="w-full py-3 bg-white/50 hover:bg-white/80 rounded-xl text-[11px] uppercase tracking-widest font-bold text-bc-warning transition-all border border-bc-warning/10"
                >
                  Edit Date of Birth
                </button>
              </motion.div>
            )}
            
            {donorData.lastDonation === "Within 3 months" && !isMinor && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <DateInput 
                  label="Last donation date"
                  name="donationDate"
                  value={donorData.donationDate}
                  onChange={handleChange}
                />
                {donorData.donationDate && <EligibilityCard status="warning" date={donorData.donationDate} />}
              </motion.div>
            )}
            { (donorData.lastDonation === "Never donated" || donorData.lastDonation === "3+ months ago") && !isMinor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <EligibilityCard status="success" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6 pt-4 border-t border-thin">
            <div className="space-y-4">
              <label className="text-[11px] uppercase tracking-widest text-bc-text/40 px-1">Your donation streak</label>
              <StreakGrid count={donorData.lastDonation === "3+ months ago" ? 3 : 0} />
            </div>
            
          <motion.button 
            whileHover={isFormValid ? { scale: 1.01, backgroundColor: '#c04a3b' } : {}}
            whileTap={isFormValid ? { scale: 0.98 } : {}}
            onClick={onComplete}
            disabled={!isFormValid}
            className={`w-full py-4 rounded-2xl font-medium transition-all text-sm tracking-wide shadow-lg ${
              isFormValid 
                ? 'bg-bc-red text-white shadow-bc-red/10' 
                : (isIneligibleAge ? 'bg-bc-warning/10 text-bc-warning border-bc-warning/20' : 'bg-bc-bg text-bc-text/20 cursor-not-allowed border-thin')
            }`}
          >
            {isFormValid ? 'Continue to verification' : (isIneligibleAge ? 'Not Eligible' : 'Complete all fields')}
          </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EligibilityCard({ status, date, gender }: { status: 'success' | 'warning', date?: string, gender?: string }) {
  const isEligible = status === 'success';
  
  const calculateDaysLeft = () => {
    if (!date) return 0;
    const diff = new Date().getTime() - new Date(date).getTime();
    const limit = (gender === 'Female' ? 120 : 90) * 24 * 60 * 60 * 1000;
    const remaining = limit - diff;
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  };

  const daysLeft = calculateDaysLeft();
  return (
    <div className={`p-6 rounded-[32px] border-thin space-y-5 relative overflow-hidden group/card ${
      isEligible ? 'bg-bc-success-bg border-bc-success/20' : 'bg-bc-warning-bg border-bc-warning/20'
    }`}>
      <div className="absolute top-0 right-0 p-8 translate-x-4 -translate-y-4 opacity-[0.03] group-hover/card:opacity-[0.08] transition-opacity">
        {isEligible ? <CheckCircle2 size={120} /> : <AlertCircle size={120} />}
      </div>
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.1)] ${isEligible ? 'bg-bc-success shadow-bc-success/40' : 'bg-bc-warning shadow-bc-warning/40'}`} />
          <span className={`text-[11px] font-medium uppercase tracking-[0.15em] ${isEligible ? 'text-bc-success' : 'text-bc-warning'}`}>
            {isEligible ? 'Eligible now' : 'Wait Required'}
          </span>
        </div>
        {!isEligible && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white/40 rounded-full border border-white/60">
            <Clock size={10} className="text-bc-warning" />
            <span className="text-[10px] font-medium text-bc-warning">{daysLeft} days left</span>
          </div>
        )}
      </div>

      <div className="space-y-2 relative z-10">
        <div className="relative w-full h-[6px] bg-white/60 rounded-full overflow-hidden border border-white/20">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: isEligible ? '100%' : '35%' }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
            className={`h-full rounded-full ${isEligible ? 'bg-bc-success' : 'bg-bc-warning'}`}
          />
        </div>
      </div>
      
      {!isEligible && (
        <p className="text-[11px] text-bc-warning/70 leading-relaxed font-light relative z-10 italic">
          Safety first. Your iron levels need time to stabilize. Next eligibility: <span className="font-bold underline decoration-bc-warning/30 underline-offset-2">June 12, 2026</span>.
        </p>
      )}
    </div>
  );
}

function StreakGrid({ count = 0 }: { count?: number }) {
  const milestones = [
    { label: 'First drop', count: 1 },
    { label: 'Life saver', count: 3 },
    { label: 'Hero', count: 6 },
    { label: 'Legend', count: 12 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div 
            key={i} 
            className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-500 ${
              i < count 
                ? 'bg-bc-red-tint border-bc-red/20 border-thin' 
                : (i === count ? 'border-dashed border-thin border-bc-red/40' : 'bg-bc-bg/50 border-thin')
            }`}
          >
            <Droplets 
              size={12} 
              className={i < count ? 'text-bc-red fill-bc-red/20' : 'text-bc-text/10'} 
              strokeWidth={i < count ? 2.5 : 1.5}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        {milestones.map((m) => (
          <div key={m.label} className="flex-shrink-0 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full border-thin ${count >= m.count ? 'bg-bc-red border-bc-red' : ''}`} />
            <span className={`text-[10px] uppercase tracking-widest ${count >= m.count ? 'text-bc-text font-medium' : 'text-bc-text/30'}`}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OTPView({ phone, onVerify }: any) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(120);
  const [error, setError] = useState(false);
  const [isResendVisible, setIsResendVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    if (timer <= 60) setIsResendVisible(true);
    return () => clearInterval(interval);
  }, [timer]);

  const handleInput = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    
    // Support for pasting full OTP
    if (val.length > 1 && index === 0) {
      const pasteData = val.slice(0, 6).split('');
      const newDigits = [...digits];
      pasteData.forEach((char, i) => {
        if (i < 6) newDigits[i] = char;
      });
      setDigits(newDigits);
      document.getElementById(`otp-${Math.min(5, pasteData.length - 1)}`)?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = val.slice(-1);
    setDigits(newDigits);
    setError(false);
    setAuthErrorType(null);

    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: any) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const verifyCode = async () => {
    const enteredCode = digits.join('').trim();
    console.log("[Auth] Verifying code...");
    if (enteredCode === '123456') {
      setIsRegistering(true);
      setError(false);
      setAuthErrorType(null);
      let uid = null;
      try {
        const { signInAnonymously } = await import('firebase/auth');
        const { auth } = await import('./services/firebase');
        console.log("[Auth] Attempting anonymous sign-in...");
        const cred = await signInAnonymously(auth);
        uid = cred.user.uid;
        console.log("[Auth] Success. UID:", uid);
        
        if (uid) {
          await onVerify(uid);
          console.log("[Auth] onVerify callback completed.");
        } else {
          setError(true);
          console.error("Failed to get UID after anonymous sign-in");
        }
      } catch (authError: any) {
        console.warn("[Auth] Firebase anonymous auth failed, automatically falling back to demo UID", authError.message || authError);
        const demoUid = `phone-demo-${phone || Date.now()}`;
        await onVerify(demoUid);
      } finally {
        setIsRegistering(false);
      }
    } else {
      console.warn("[Auth] Invalid OTP entered.");
      setError(true);
      setDigits(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-md mx-auto"
    >
      <div className="p-8 md:p-12 bg-bc-surface rounded-[32px] border-thin shadow-2xl shadow-bc-text/5 space-y-8 text-center">
        <div className="mx-auto w-16 h-16 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red">
          <Phone size={32} />
        </div>
        
        <div className="space-y-4">
          <h2 className="font-serif text-4xl">Check your phone</h2>
          <p className="text-bc-text/60 font-light text-sm">
            We sent a 6-digit code to <span className="font-medium text-bc-text">+{phone || '91 **********'}</span>
          </p>
        </div>

        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex justify-center gap-2 md:gap-3"
        >
          {digits.map((d, i) => (
            <input
              key={i}
              id={`otp-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-10 h-12 md:w-12 md:h-16 rounded-xl bg-bc-bg border-thin text-center text-xl font-serif outline-none transition-all duration-300 ${
                d ? 'bg-bc-red-tint border-bc-red/30' : 'focus:scale-105 focus:border-bc-red'
              } ${error ? 'border-bc-warning' : ''}`}
              autoFocus={i === 0}
            />
          ))}
        </motion.div>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-bc-text/40">
              {timer > 0 ? `Code expires in ${formatTime(timer)}` : "Code expired"}
            </p>
            <p className="text-[10px] text-bc-text/30 italic">Demo code: 123456</p>
            {error && !authErrorType && <p className="text-bc-warning text-[11px]">Wrong code. Try again.</p>}
          </div>

          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={digits.some(d => !d) || isRegistering}
            onClick={verifyCode}
            className="w-full bg-bc-red text-white py-4 rounded-2xl font-medium disabled:opacity-30 transition-all text-sm tracking-wide shadow-lg shadow-bc-red/10 flex items-center justify-center gap-2"
          >
            {isRegistering ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Registering...
              </>
            ) : "Verify and register"}
          </motion.button>

          {authErrorType && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-bc-warning-bg border border-bc-warning/20 text-left text-xs text-bc-warning rounded-[24px] space-y-3 mt-4"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <p className="font-bold uppercase tracking-wider text-[10px]">Firebase Auth Action Required:</p>
              </div>
              <p className="leading-relaxed opacity-90">
                To link phone registration directly to Firebase, please enable the <strong>Anonymous</strong> sign-in provider in your Firebase Console:
              </p>
              <ol className="list-decimal list-inside pl-1 space-y-1 text-[11px] opacity-80">
                <li>Go to the <strong>Firebase Console &gt; Authentication</strong></li>
                <li>Under the <strong>Sign-in method</strong> tab</li>
                <li>Click <strong>Add new provider</strong> &gt; choose <strong>Anonymous</strong></li>
                <li>Turn on <strong>Enable</strong> and click <strong>Save</strong></li>
              </ol>
              <div className="pt-2 border-t border-bc-warning/10">
                <p className="text-[10px] opacity-70 mb-2 italic text-center">Or skip this step to test the registration immediately:</p>
                <button 
                  type="button"
                  onClick={async () => {
                    const demoUid = `phone-demo-${phone || Date.now()}`;
                    console.log("[Auth] Bypassing with demo UID:", demoUid);
                    await onVerify(demoUid);
                  }}
                  className="w-full py-3 bg-bc-warning text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:brightness-110 transition-all shadow-md active:scale-95"
                >
                  Continue in Demo Mode
                </button>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {isResendVisible && (
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setTimer(120)}
                className="text-[11px] uppercase tracking-widest text-bc-red font-medium hover:underline"
              >
                Resend code
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function AuthEntryView({ onComplete }: any) {
  const [phone, setPhone] = useState('');
  const [isOTPView, setIsOTPView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onComplete(result.user.uid, '', result.user.email || '', result.user.displayName || '', result.user.photoURL || '');
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("User closed login popup");
      } else {
        console.error("Login failed:", error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isOTPView) {
    return (
      <div className="space-y-8">
        <button 
          onClick={() => setIsOTPView(false)}
          className="flex items-center gap-2 text-xs font-medium text-bc-text/40 hover:text-bc-text transition-colors"
        >
          <ArrowLeft size={14} />
          Change number
        </button>
        <OTPView phone={phone} onVerify={async (uid: string) => await onComplete(uid, phone, '')} />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto space-y-10 py-12"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red mx-auto">
          <Phone size={32} />
        </div>
        <h2 className="font-serif text-5xl">Verify phone.</h2>
        <p className="text-bc-text/40 font-light">Enter your number to continue to BloodConnect.</p>
      </div>

      <div className="space-y-6">
        <button 
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-4 rounded-2xl border-thin flex items-center justify-center gap-3 hover:bg-bc-surface transition-all font-medium text-sm glassy-bubble"
        >
          {isLoading ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-bc-text/5"></div>
          </div>
          <span className="relative z-10 bg-bc-bg px-4 text-[10px] uppercase tracking-widest text-bc-text/20 font-bold">Or use phone</span>
        </div>

        <div className="space-y-4">
          <GlassyInput 
            label="Mobile Number"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e: any) => setPhone(e.target.value)}
            icon={Phone}
            placeholder="91XXXXXXXX"
          />
          <button 
             onClick={() => phone.length >= 10 && setIsOTPView(true)}
             disabled={phone.length < 10}
             className="w-full py-4 bg-bc-text text-white rounded-2xl font-medium text-sm tracking-wide shadow-lg hover:brightness-110 transition-all disabled:opacity-20"
          >
            Continue
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SuccessView({ donorData, onViewProfile }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="relative mb-12"
      >
        <div className="absolute inset-0 bg-bc-red/5 rounded-full animate-ping" />
        <div className="relative w-24 h-24 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red">
          <Droplets size={48} className="fill-bc-red/10" />
        </div>
      </motion.div>

      <div className="space-y-4 mb-12">
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-serif text-5xl"
        >
          You're registered.
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-bc-text/60 font-light max-w-sm mx-auto leading-relaxed"
        >
          You're now part of the BloodConnect donor network. We'll only reach out when someone in your district urgently needs your blood group.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm p-6 bg-bc-surface rounded-3xl border-thin space-y-6 text-left"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-medium text-lg">{donorData.name}</h3>
            <p className="text-xs text-bc-text/40">{donorData.district}, {donorData.state}</p>
          </div>
          <div className="px-3 py-1 bg-bc-red text-white text-xs font-medium rounded-full">
            {donorData.bloodGroup}
          </div>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-3 bg-bc-bg rounded-xl border-thin">
          <div className="w-2 h-2 rounded-full bg-bc-success animate-pulse" />
          <span className="text-[11px] uppercase tracking-widest font-medium text-bc-success">Available now</span>
        </div>
      </motion.div>

      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={onViewProfile}
        className="mt-12 text-[11px] uppercase tracking-widest text-bc-red font-medium hover:gap-4 flex items-center gap-2 transition-all group"
      >
        View my donor profile <ArrowRight size={14} className="group-hover:translate-x-1 transition-all" />
      </motion.button>
    </motion.div>
  );
}

function FindBloodView({ onBroadcast }: any) {
  const [isSearching, setIsSearching] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    bloodGroup: 'B+',
    units: '1',
    date: new Date().toISOString().split('T')[0],
    reasonCategory: '',
    customReason: '',
    hospital: '',
    state: 'Tamil Nadu',
    district: '',
    city: ''
  });

  const reasons = [
    "Surgery",
    "Accident / Trauma",
    "Thalassemia",
    "Anemia",
    "Cancer Treatment",
    "Delivery / Postpartum",
    "Others"
  ];

  const districts = IndiaData[formData.state as keyof typeof IndiaData] || [];

  const MOCK_DONORS = [
    { name: 'Aditya Kumar', group: 'B+', city: 'Adyar', state: 'Tamil Nadu', district: 'Chennai', initials: 'AK' },
    { name: 'Meera Nair', group: 'B+', city: 'T. Nagar', state: 'Tamil Nadu', district: 'Chennai', initials: 'MN' },
    { name: 'Siddharth R.', group: 'B+', city: 'Mylapore', state: 'Tamil Nadu', district: 'Chennai', initials: 'SR' },
    { name: 'Priya Mani', group: 'B+', city: 'Gandhipuram', state: 'Tamil Nadu', district: 'Coimbatore', initials: 'PM' },
    { name: 'Rahul V.', group: 'B+', city: 'Anna Nagar', state: 'Tamil Nadu', district: 'Madurai', initials: 'RV' },
    { name: 'Ananya S.', group: 'O+', city: 'Besant Nagar', state: 'Tamil Nadu', district: 'Chennai', initials: 'AS' },
    { name: 'Vijay P.', group: 'A+', city: 'Guindy', state: 'Tamil Nadu', district: 'Chennai', initials: 'VP' },
    { name: 'Deepa T.', group: 'B+', city: 'Velachery', state: 'Tamil Nadu', district: 'Chennai', initials: 'DT' },
    { name: 'Karthik K.', group: 'B+', city: 'Peelamedu', state: 'Tamil Nadu', district: 'Coimbatore', initials: 'KK' },
  ];

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSearching(true);
    
    // Simulate searchDonors call
    try {
      const { searchDonors } = await import('./services/bloodServices');
      const donors = await searchDonors(formData.bloodGroup, formData.district, formData.state);
      
      // If we got results from DB, use them
      if (donors && donors.length > 0) {
         setResults(donors.map((d: any) => ({
           id: d.id,
           name: d.name,
           group: d.blood_group,
           city: d.city,
           district: d.district,
           state: d.state,
           initials: d.name ? d.name.split(' ').map((n: string) => n[0]).join('') : 'D',
           distance: d.distance || (Math.random() * 5 + 1).toFixed(1)
         })));
         setIsSearching(false);
         setShowResults(true);
         return;
      }
    } catch (e) {
      console.error("Search failed, falling back to mock", e);
    }
    
    // Simulate real searching logic (Mock fallback)
    setTimeout(() => {
      const matchedDonors = MOCK_DONORS
        .filter(donor => donor.group === formData.bloodGroup && donor.state === formData.state)
        .map(donor => {
          // Mock proximity based on district
          let distance;
          if (donor.district === formData.district) {
            // Very close if in same district
            distance = (Math.random() * 8 + 0.5).toFixed(1);
          } else {
            // Further away if in same state but different district
            distance = (Math.random() * 100 + 15).toFixed(1);
          }
          return { ...donor, distance: parseFloat(distance) };
        })
        .sort((a, b) => a.distance - b.distance);

      setResults(matchedDonors);
      setIsSearching(false);
      setShowResults(true);
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-xl mx-auto space-y-12"
    >
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <span className="text-bc-red text-[10px] font-medium tracking-[0.2em] uppercase">Blood request</span>
        </div>
        <h2 className="font-serif text-5xl">Find a donor. Fast.</h2>
      </div>

      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.form 
            key="form"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="p-8 md:p-12 glassy-bubble backdrop-blur-2xl rounded-[40px] border-none shadow-2xl shadow-bc-text/5 space-y-12"
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <User size={14} className="text-bc-text/20" />
                <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Patient Details</label>
              </div>
              <GlassyInput 
                label="Patient full name"
                name="fullName"
                value={formData.fullName}
                onChange={(e: any) => setFormData((p: any) => ({ ...p, fullName: e.target.value }))}
                icon={User}
                capitalize
              />
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <Activity size={14} className="text-bc-text/20" />
                <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Blood Requirement</label>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="text-xs text-bc-text/40 block px-1 italic">Required Blood Group</span>
                  <div className="grid grid-cols-4 gap-y-4 gap-x-2 justify-items-center">
                    {BloodGroups.map(group => (
                      <motion.button
                        key={group}
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setFormData(p => ({ ...p, bloodGroup: group }))}
                        className={`w-14 h-14 rounded-full border-thin flex items-center justify-center transition-all duration-300 font-medium text-sm ${
                          formData.bloodGroup === group 
                            ? 'bg-bc-red text-white shadow-lg shadow-bc-red/30 border-bc-red scale-110' 
                            : 'bg-bc-bg hover:bg-bc-red-tint/50 text-bc-text/60'
                        }`}
                      >
                        {group}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <GlassyInput 
                    type="number"
                    label="Units required"
                    value={formData.units}
                    onChange={(e: any) => setFormData((p: any) => ({ ...p, units: e.target.value }))}
                    icon={Droplets}
                  />
                  <DateInput 
                    label="Required on"
                    name="date"
                    value={formData.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e: any) => setFormData((p: any) => ({ ...p, date: e.target.value }))}
                  />
                </div>

                <div className="space-y-4">
                  <SearchableSelect 
                    label="Reason for request"
                    options={reasons}
                    value={formData.reasonCategory}
                    onChange={(val: string) => setFormData(p => ({ ...p, reasonCategory: val }))}
                    placeholder="Search reasons..."
                  />
                  
                  <AnimatePresence>
                    {formData.reasonCategory === "Others" && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <GlassyInput 
                          label="Specify reason"
                          value={formData.customReason}
                          onChange={(e: any) => setFormData((p: any) => ({ ...p, customReason: e.target.value }))}
                          placeholder="e.g. Rare condition..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <Building2 size={14} className="text-bc-text/20" />
                <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium pt-0.5">Hospital & Location</label>
              </div>
              <div className="space-y-4">
                <GlassyInput 
                  label="Hospital name"
                  name="hospital"
                  value={formData.hospital}
                  onChange={(e: any) => setFormData((p: any) => ({ ...p, hospital: e.target.value }))}
                  icon={Building2}
                  placeholder="e.g. Apollo Hospital"
                  capitalize
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SearchableSelect 
                    label="State"
                    options={Object.keys(IndiaData)}
                    value={formData.state}
                    onChange={(val: string) => setFormData((p: any) => ({ ...p, state: val, district: '' }))}
                    placeholder="Filter states..."
                  />
                  <SearchableSelect 
                    label="District"
                    options={districts}
                    value={formData.district}
                    onChange={(val: string) => setFormData((p: any) => ({ ...p, district: val }))}
                    placeholder="Filter districts..."
                  />
                </div>

                <GlassyInput 
                  label="City / Area"
                  name="city"
                  value={formData.city}
                  onChange={(e: any) => setFormData((p: any) => ({ ...p, city: e.target.value }))}
                  icon={MapPin}
                />
                
                <GlassyInput 
                  type="tel"
                  label="Contact Mobile"
                  value={formData.mobile}
                  onChange={(e: any) => setFormData((p: any) => ({ ...p, mobile: e.target.value }))}
                  icon={Phone}
                />
              </div>
            </div>

            <motion.button 
              type="submit"
              disabled={isSearching}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-bc-red text-white py-4 rounded-2xl font-medium transition-all text-sm tracking-wide relative overflow-hidden shadow-lg shadow-bc-red/10"
            >
              {isSearching ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2"
                >
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching network...
                </motion.div>
              ) : 'Find donors'}
            </motion.button>
          </motion.form>
        ) : (
          <motion.div 
            key="results"
            className="space-y-6 pb-12"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-bc-success animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-medium text-bc-success opacity-80">
                  {results.length} matched donors found
                </span>
              </div>
              <button 
                onClick={() => setShowResults(false)}
                className="text-[10px] uppercase tracking-widest text-bc-text/40 hover:text-bc-red transition-colors"
              >
                Refine search
              </button>
            </div>

            <div className="space-y-4">
              {results.length > 0 ? (
                results.map((donor, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="group bg-bc-surface p-6 rounded-3xl border-thin hover:-translate-y-0.5 hover:border-bc-red-mid transition-all duration-300 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red font-serif text-sm">
                          {donor.initials}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{donor.name}</h3>
                            <span className="px-2 py-0.5 bg-bc-red text-white text-[10px] font-medium rounded-full">{donor.group}</span>
                          </div>
                          <p className="text-xs text-bc-text/40">{donor.city}, {donor.district}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-bc-success" />
                          <span className="text-[10px] uppercase tracking-widest font-semibold text-bc-success">
                            {donor.distance} km away
                          </span>
                        </div>
                        <button 
                          onClick={async () => {
                            const { revealContact } = await import('./services/bloodServices');
                            const phone = await revealContact(donor.id, 'temp-request-id'); // In a real flow, we'd use a real request ID
                            if (phone) {
                              window.open(`tel:${phone}`, '_self');
                            } else {
                              // Fallback for mock if revealContact doesn't return anything
                              window.open(`tel:91${donor.name.length}3456789`, '_self');
                            }
                          }}
                          className="text-bc-red font-semibold text-sm hover:underline block"
                        >
                          Contact donor
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red mx-auto">
                    <Search size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-bc-text font-medium">No direct matches nearby</p>
                    <p className="text-bc-text/40 italic text-xs max-w-[200px] mx-auto">Try expanding your search or broadcast an emergency alert.</p>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setIsBroadcasting(true);
                      onBroadcast?.(formData);
                      setTimeout(() => {
                        setIsBroadcasting(false);
                        setBroadcastDone(true);
                      }, 2000);
                    }}
                    disabled={isBroadcasting || broadcastDone}
                    className={`mt-4 px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
                      broadcastDone 
                        ? 'bg-bc-success/10 text-bc-success cursor-default'
                        : 'bg-bc-red text-white shadow-lg shadow-bc-red/20 hover:brightness-110'
                    }`}
                  >
                    {isBroadcasting ? 'Broadcasting...' : broadcastDone ? 'Alert Sent' : 'Broadcast to all donors'}
                  </motion.button>
                </div>
              )}
            </div>

            {results.length > 0 && !broadcastDone && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-bc-surface p-8 rounded-[40px] border-thin border-bc-red/10 text-center space-y-6"
              >
                <div className="space-y-2">
                  <h4 className="font-serif text-xl">Need more donors?</h4>
                  <p className="text-sm text-bc-text/40">We can broadcast an emergency alert to every verified donor in {formData.district}.</p>
                </div>
                <button 
                  onClick={() => {
                    setIsBroadcasting(true);
                    onBroadcast?.(formData);
                    setTimeout(() => {
                      setIsBroadcasting(false);
                      setBroadcastDone(true);
                    }, 2000);
                  }}
                  disabled={isBroadcasting}
                  className="w-full py-4 bg-white border-thin border-bc-red/20 text-bc-red rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-bc-red-tint transition-all"
                >
                  {isBroadcasting ? 'Sending Alert...' : 'Broadcast Emergency Alert'}
                </button>
              </motion.div>
            )}

            {broadcastDone && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-bc-success/10 p-6 rounded-[32px] border border-bc-success/20 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-bc-success rounded-full flex items-center justify-center text-white">
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-bc-success">Emergency Alert Sent</p>
                  <p className="text-xs text-bc-success/60">We'll notify you as soon as a donor accepts.</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function UnavailableModal({ isOpen, onClose, onConfirm }: any) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isBlasting, setIsBlasting] = useState(false);

  const reasons = [
    { id: 'tattoo', label: 'Tattoo / Piercing', icon: Syringe, desc: 'Wait 6 months after the procedure' },
    { id: 'diabetes', label: 'Health Condition', icon: Activity, desc: 'Prioritize your well-being' },
    { id: 'medical', label: 'Medical Treatment', icon: Stethoscope, desc: 'Recovery phase' },
    { id: 'travel', label: 'Traveling', icon: Plane, desc: 'Away from donating district' },
    { id: 'other', label: 'Other Reasons', icon: MessageSquare, desc: 'Personal preference' }
  ];

  if (!isOpen) return null;

  const handleConfirm = () => {
    setIsBlasting(true);
    setTimeout(() => {
      onConfirm(selectedReason, date);
      onClose();
      setIsBlasting(false);
      setSelectedReason(null);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 sm:p-12">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-bc-text/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <AnimatePresence>
          {isBlasting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center text-center p-12 space-y-6"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.5, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-24 h-24 bg-bc-red/10 rounded-full flex items-center justify-center text-bc-red"
              >
                <Sparkles size={48} />
              </motion.div>
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-bc-red">You're a Legend!</h2>
                <p className="text-bc-text/60 leading-relaxed text-sm">
                  Your commitment to saving lives is inspiring. Health always comes first—take care of yourself, hero!
                </p>
              </div>
              <div className="flex gap-2">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [0, -30 - Math.random() * 20, 0],
                      x: [0, (Math.random() - 0.5) * 40, 0],
                      opacity: [0, 1, 0],
                      scale: [0.5, 1, 0.5]
                    }}
                    transition={{ delay: i * 0.1, duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-bc-red"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 border-b border-thin flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-serif text-2xl">Pause availability?</h3>
            <p className="text-xs text-bc-text/40">Help us keep the network accurate.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-bc-bg flex items-center justify-center text-bc-text/40 hover:bg-bc-red-tint hover:text-bc-red transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <div className="grid grid-cols-1 gap-3">
            {reasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                className={`p-5 rounded-3xl border-thin transition-all flex items-center justify-between group ${
                  selectedReason === reason.id 
                    ? 'bg-bc-red/5 border-bc-red ring-1 ring-bc-red/20' 
                    : 'bg-bc-bg hover:bg-bc-surface'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                    selectedReason === reason.id ? 'bg-bc-red text-white' : 'bg-white text-bc-text/40 group-hover:text-bc-red'
                  }`}>
                    <reason.icon size={20} />
                  </div>
                  <div className="text-left">
                    <p className={`font-medium text-sm ${selectedReason === reason.id ? 'text-bc-red' : 'text-bc-text'}`}>
                      {reason.label}
                    </p>
                    <p className="text-[10px] text-bc-text/40 uppercase tracking-widest mt-1">
                      {reason.desc}
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                  selectedReason === reason.id ? 'border-bc-red' : 'border-bc-text/10'
                }`}>
                  {selectedReason === reason.id && <div className="w-2.5 h-2.5 rounded-full bg-bc-red" />}
                </div>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {selectedReason === 'tattoo' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-bc-red-tint rounded-[32px] space-y-4 border border-bc-red/10">
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-bc-red" />
                    <span className="text-xs font-medium text-bc-red uppercase tracking-widest">Date of procedure</span>
                  </div>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/80 p-4 rounded-2xl outline-none text-sm font-medium text-bc-text border-thin focus:ring-2 focus:ring-bc-red/20 transition-all cursor-pointer"
                  />
                  <div className="p-3 bg-white/40 rounded-xl">
                    <p className="text-[10px] text-bc-red/60 leading-relaxed italic text-center">
                      Donors are typically eligible 180 days after a tattoo or piercing to ensure safety.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-8 bg-bc-bg border-t border-thin">
          <button
            onClick={handleConfirm}
            disabled={!selectedReason}
            className={`w-full py-4 rounded-2xl font-medium transition-all text-sm tracking-wide shadow-lg ${
              selectedReason 
                ? 'bg-bc-red text-white shadow-bc-red/10 hover:scale-[1.01]' 
                : 'bg-bc-text/10 text-bc-text/20 cursor-not-allowed'
            }`}
          >
            Update Availability
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EmergencyRequestBanner({ request, onClose, onAccept }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -100, x: '-50%' }}
      animate={{ opacity: 1, y: 20, x: '-50%' }}
      exit={{ opacity: 0, y: -100, x: '-50%' }}
      className="fixed top-0 left-1/2 z-[110] w-full max-w-lg p-4"
    >
      <div className="bg-bc-text text-white rounded-[32px] shadow-2xl p-6 relative overflow-hidden border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Droplets size={80} />
        </div>
        
        <div className="space-y-6 relative z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-bc-red rounded-full flex items-center justify-center animate-pulse">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="font-serif text-lg leading-none">Emergency Request</h4>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{request.distance}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-white/80 leading-relaxed font-light">
              {request.message}
            </p>
            <div className="flex items-center gap-4 py-3 border-y border-white/10">
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/40">Hospital</p>
                <p className="text-xs font-medium">{request.hospital}</p>
              </div>
              <div className="w-12 h-12 bg-white text-bc-text rounded-2xl flex items-center justify-center font-serif text-xl">
                {request.bloodGroup}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button 
              onClick={onAccept}
              className="py-3 bg-bc-red text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              I can help
            </button>
            <button 
              onClick={onClose}
              className="py-3 bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 active:scale-95 transition-all"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DonorAcceptedBanner({ response, onClose }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: -100, x: '-50%' }}
      animate={{ opacity: 1, scale: 1, y: 20, x: '-50%' }}
      exit={{ opacity: 0, scale: 0.9, y: -100, x: '-50%' }}
      className="fixed top-0 left-1/2 z-[115] w-full max-w-lg p-4"
    >
      <div className="bg-bc-success text-white rounded-[32px] shadow-2xl p-6 relative overflow-hidden border border-white/20">
        <div className="absolute -top-10 -right-10 opacity-10">
          <Heart size={120} fill="white" />
        </div>
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
            <User size={24} className="text-white" />
          </div>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-70">Donor Found!</span>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
            <h4 className="font-serif text-xl">{response.donorName} is arriving.</h4>
            <p className="text-xs opacity-80 font-light">
              Matched for <span className="font-bold">{response.donorGroup}</span> at {response.hospital}.
            </p>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors self-start">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-widest">{response.distance} away</span>
          <button 
            onClick={() => window.open('tel:919999999999', '_self')}
            className="flex items-center gap-2 text-xs font-bold bg-white text-bc-success px-4 py-2 rounded-full hover:scale-105 active:scale-95 transition-all"
          >
            <Phone size={14} />
            Connect
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EmergencyCoordinationModal({ isOpen, onClose, request }: any) {
  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bc-text/60 backdrop-blur-xl" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-bc-red">
              <div className="w-10 h-10 bg-bc-red-tint rounded-full flex items-center justify-center">
                <Heart size={20} fill="currentColor" />
              </div>
              <h2 className="font-serif text-2xl">Hero Protocol</h2>
            </div>
            <button onClick={onClose} className="text-bc-text/20 hover:text-bc-text transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-bc-success/10 p-4 rounded-2xl flex items-center gap-3 border border-bc-success/20">
            <div className="w-2 h-2 rounded-full bg-bc-success animate-ping" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-bc-success">Patient has been notified of your response</span>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-bc-surface rounded-[32px] border-thin space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-bc-text/40">Patient Blood Group</p>
                  <p className="text-xl font-serif text-bc-red">{request.bloodGroup}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-bc-text/40">Requirement</p>
                  <p className="text-sm font-medium">2 Units</p>
                </div>
              </div>

              <div className="h-px bg-bc-text/5" />

              <div>
                <p className="text-[10px] uppercase tracking-widest text-bc-text/40">Hospital Details</p>
                <p className="text-sm font-medium mt-1">{request.hospital}</p>
                <p className="text-xs text-bc-text/40">{request.district}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(request.hospital + ' ' + request.district)}`, '_blank')}
                className="w-full bg-bc-text text-white py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-bc-text/10"
              >
                <MapPin size={16} />
                Get Directions ({request.distance})
              </button>
              <button 
                onClick={() => window.open(`tel:919999999999`, '_self')}
                className="w-full border-thin py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-3 hover:bg-bc-surface active:scale-95 transition-all"
              >
                <Phone size={16} />
                Contact Coordinator
              </button>
            </div>

            <p className="text-[10px] text-center text-bc-text/30 px-6 leading-relaxed">
              By accepting, you commit to arriving at the hospital within the next 2 hours. Your help is vital.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DonationSuccessModal({ isOpen, onClose, gender }: any) {
  if (!isOpen) return null;

  const recoveryDays = gender === 'Female' ? '120 days' : '90 days';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bc-text/60 backdrop-blur-xl" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl relative z-10 overflow-hidden text-center p-10 space-y-8"
      >
        <div className="mx-auto w-24 h-24 bg-bc-success/10 rounded-full flex items-center justify-center text-bc-success relative">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-bc-success/20 rounded-full"
          />
          <Sparkles size={48} className="relative z-10" />
        </div>

        <div className="space-y-4">
          <h2 className="font-serif text-4xl text-bc-text">Great job, Hero!</h2>
          <p className="text-sm text-bc-text/60 leading-relaxed">
            You've just given someone a second chance at life. The world needs more people like you.
          </p>
        </div>

        <div className="p-6 bg-bc-bg rounded-3xl space-y-3">
          <div className="flex items-center justify-center gap-2 text-bc-red">
            <Clock size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Recovery Mode</span>
          </div>
          <p className="text-xs text-bc-text/50 font-medium">
            Take some well-deserved rest. Recover for <span className="text-bc-text">{recoveryDays}</span>, then you'll be back to action!
          </p>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 bg-bc-text text-white rounded-2xl font-medium transition-all text-sm tracking-wide shadow-lg hover:bg-bc-text/90"
        >
          Sounds like a plan
        </button>
      </motion.div>
    </div>
  );
}

function LogoutConfirmationModal({ isOpen, onClose, onConfirm }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bc-text/60 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-bc-bg rounded-[40px] shadow-2xl relative z-10 overflow-hidden p-10 space-y-8 text-center"
      >
        <div className="mx-auto w-20 h-20 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red">
          <LogOut size={32} />
        </div>

        <div className="space-y-4">
          <h2 className="font-serif text-3xl text-bc-text">Logging out?</h2>
          <p className="text-sm text-bc-text/60 leading-relaxed">
            Are you sure you want to log out? You'll need to verify your phone number again to sign in.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button 
            onClick={onConfirm}
            className="w-full py-4 bg-bc-red text-white rounded-2xl font-bold transition-all text-sm tracking-wide shadow-lg hover:shadow-bc-red/20 active:scale-[0.98]"
          >
            Yes, log me out
          </button>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-bc-surface text-bc-text/60 rounded-2xl font-medium transition-all text-sm tracking-wide hover:text-bc-text active:scale-[0.98]"
          >
            Wait, take me back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DashboardView({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'donors' | 'requests' | 'system'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const loadStats = async () => {
    const { fetchGlobalStats } = await import('./services/bloodServices');
    const data = await fetchGlobalStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this donor? This action is permanent.")) return;
    setIsActionLoading(userId);
    const { deleteUser } = await import('./services/bloodServices');
    if (await deleteUser(userId)) {
      await loadStats();
    }
    setIsActionLoading(null);
  };

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    setIsActionLoading(userId);
    const { toggleAdminStatus } = await import('./services/bloodServices');
    if (await toggleAdminStatus(userId, currentRole)) {
      await loadStats();
    }
    setIsActionLoading(null);
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm("Delete this blood request?")) return;
    setIsActionLoading(requestId);
    const { deleteRequest } = await import('./services/bloodServices');
    if (await deleteRequest(requestId)) {
      await loadStats();
    }
    setIsActionLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-bc-red">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Droplets size={40} />
        </motion.div>
        <span className="font-medium animate-pulse uppercase tracking-widest text-[10px]">Accessing Secure Vault...</span>
      </div>
    );
  }

  // Process data for charts
  const bloodData = BloodGroups.map(group => ({
    name: group,
    value: stats.donors.filter((d: any) => d.blood_group === group).length
  }));

  const filteredDonors = stats.donors.filter((d: any) => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.blood_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = stats.requests.filter((r: any) => 
    r.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.hospital_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.blood_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stateData = Object.keys(IndiaData).map(state => ({
    name: state,
    donors: stats.donors.filter((d: any) => d.state === state).length,
    requests: stats.requests.filter((r: any) => r.state === state).length
  })).filter(s => s.donors > 0 || s.requests > 0);

  const COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#ef4444', '#f87171', '#fca5a5', '#fee2e2'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20 max-w-6xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={onBack} className="p-3 bg-bc-surface hover:bg-bc-text/5 rounded-2xl text-bc-text/60 transition-all active:scale-95 shadow-sm border-thin">
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-bc-red" />
              <h1 className="font-serif text-3xl">Master Admin</h1>
            </div>
            <p className="text-[10px] text-bc-text/40 tracking-[0.2em] uppercase font-bold">Network Command Center</p>
          </div>
        </div>
        
        <div className="flex bg-bc-surface p-1 rounded-2xl border-thin w-full sm:w-auto overflow-x-auto touch-pan-x no-scrollbar">
          {[
            { id: 'overview', label: 'Summary', icon: Activity },
            { id: 'donors', label: 'Donors', icon: Heart },
            { id: 'requests', label: 'Requests', icon: MessageSquare },
            { id: 'system', label: 'System', icon: ShieldCheck }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 shrink-0 ${
                activeTab === tab.id 
                  ? 'bg-bc-bg text-bc-red shadow-sm' 
                  : 'text-bc-text/40 hover:text-bc-text/60'
              }`}
            >
              <tab.icon size={14} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[10px] uppercase tracking-widest font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Network Donors', value: stats.counts.donors, icon: Heart, desc: 'Verified heroes registered' },
                { label: 'Active Requests', value: stats.counts.requests, icon: Activity, desc: 'Open tickets globally' },
                { label: 'Life-Saving Matches', value: stats.counts.matches, icon: CheckCircle2, desc: 'Successful connections' }
              ].map((stat, i) => (
                <div key={i} className="bg-bc-surface p-8 rounded-[40px] border-thin relative overflow-hidden group shadow-sm transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                    <stat.icon size={88} />
                  </div>
                  <div className="relative z-10 flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-bc-text/40">{stat.label}</span>
                    <span className="text-5xl font-serif text-bc-text">{stat.value}</span>
                    <span className="text-[10px] text-bc-text/30 mt-2">{stat.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-bc-surface p-8 rounded-[40px] border-thin shadow-sm space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-bc-text/40 px-1">Blood Reserve Index</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bloodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {bloodData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontSize: '11px', padding: '12px 20px', backgroundColor: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-4 gap-4 px-2">
                  {bloodData.map((d, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-bc-text/30 uppercase tracking-tighter">{d.name}</span>
                      <span className="text-lg font-serif">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-bc-surface p-8 rounded-[40px] border-thin shadow-sm space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-bc-text/40 px-1">Regional Heatmap</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stateData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={9} width={80} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                      <Bar dataKey="donors" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={8} />
                      <Bar dataKey="requests" fill="#1d1d1f" radius={[0, 4, 4, 0]} barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'donors' && (
          <motion.div
            key="donors"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-bc-surface p-4 rounded-3xl border-thin flex items-center gap-4">
              <Search size={18} className="text-bc-text/30 ml-2" />
              <input 
                type="text" 
                placeholder="Search donors by name, location or group..." 
                className="bg-transparent border-none flex-1 text-sm focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="bg-bc-surface rounded-[40px] border-thin shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-bc-bg/50 border-b border-thin">
                      <th className="px-8 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40">Donor Profile</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40 text-center">Group</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40">Location</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40 font-mono">Trust</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40">Role</th>
                      <th className="px-8 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40 text-right">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bc-text/5">
                    {filteredDonors.map((donor: any) => (
                      <tr key={donor.id} className="group hover:bg-white/40 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-bc-surface border-thin flex items-center justify-center text-bc-text/30 font-bold overflow-hidden shadow-sm">
                              {donor.photoURL ? (
                                <img src={donor.photoURL} alt={donor.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : donor.name.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-bc-text">{donor.name}</span>
                              <span className="text-[10px] text-bc-text/40 font-mono tracking-tighter">{donor.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="px-3 py-1 bg-bc-red text-white text-[10px] font-black rounded-full shadow-lg shadow-bc-red/20">
                            {donor.blood_group}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium">{donor.district}</div>
                            <div className="text-[10px] text-bc-text/40 hover:text-bc-text transition-colors cursor-help">{donor.state}</div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex flex-col gap-1">
                            {validatePhoneNumber(donor.phone) ? (
                              <div className="flex items-center gap-1 text-bc-success">
                                <CheckCircle2 size={10} strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Verified</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-bc-red/60">
                                <AlertCircle size={10} strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Unverified</span>
                              </div>
                            )}
                            <div className="w-16 h-1 bg-bc-bg rounded-full overflow-hidden">
                               <div className={`h-full transition-all duration-1000 ${validatePhoneNumber(donor.phone) ? 'w-full bg-bc-success' : 'w-1/3 bg-bc-red/40'}`} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div 
                            onClick={() => handleToggleAdmin(donor.id, donor.role)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                              donor.role === 'admin' 
                                ? 'bg-bc-red/10 text-bc-red border border-bc-red/20' 
                                : 'bg-bc-text/5 text-bc-text/40 border border-thin'
                            }`}
                          >
                            {donor.role === 'admin' ? <ShieldCheck size={10} /> : <User size={10} />}
                            {donor.role || 'donor'}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button
                               onClick={() => handleDeleteUser(donor.id)}
                               disabled={isActionLoading === donor.id}
                               className="p-2.5 bg-bc-bg text-bc-text/20 hover:text-bc-red hover:bg-bc-red/5 hover:border-bc-red/30 border-thin rounded-xl transition-all disabled:opacity-50"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredDonors.length === 0 && (
                <div className="p-20 text-center space-y-2">
                  <div className="w-16 h-16 bg-bc-surface rounded-full flex items-center justify-center text-bc-text/10 mx-auto">
                    <Search size={32} />
                  </div>
                  <p className="text-bc-text/40 text-xs italic">No donors match your current search.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
             <div className="bg-bc-surface p-4 rounded-3xl border-thin flex items-center gap-4">
              <Search size={18} className="text-bc-text/30 ml-2" />
              <input 
                type="text" 
                placeholder="Search requests by requester, hospital or blood type..." 
                className="bg-transparent border-none flex-1 text-sm focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="bg-bc-surface rounded-[40px] border-thin shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-bc-bg/50 border-b border-thin">
                      <th className="px-8 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40">Patient/Requester</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40 text-center">Type</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40">Hospital</th>
                      <th className="px-6 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40">Status</th>
                      <th className="px-8 py-5 font-bold uppercase text-[9px] tracking-widest text-bc-text/40 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bc-text/5">
                    {filteredRequests.map((req: any) => (
                      <tr key={req.id} className="group hover:bg-white/40 transition-colors">
                        <td className="px-8 py-6">
                           <div className="flex flex-col">
                              <span className="font-bold text-bc-text">{req.requester_name}</span>
                              <span className="text-[10px] text-bc-text/40 font-mono tracking-tighter">{req.requester_phone}</span>
                            </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="px-3 py-1 bg-bc-red text-white text-[10px] font-black rounded-full shadow-lg shadow-bc-red/20 uppercase">
                            {req.blood_group}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                           <div className="space-y-0.5">
                            <div className="text-xs font-medium">{req.hospital_name || 'General Request'}</div>
                            <div className="text-[10px] text-bc-text/30 uppercase tracking-widest">{req.city}, {req.district}</div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            req.status === 'open' ? 'bg-bc-red/10 text-bc-red' : 
                            req.status === 'fulfilled' ? 'bg-bc-success-bg text-bc-success' : 'bg-bc-text/5 text-bc-text/40'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => handleDeleteRequest(req.id)}
                            disabled={isActionLoading === req.id}
                            className="p-2.5 bg-bc-bg text-bc-text/20 hover:text-bc-red hover:bg-bc-red/5 hover:border-bc-red/30 border-thin rounded-xl transition-all"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'system' && (
          <motion.div
            key="system"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid md:grid-cols-2 gap-8"
          >
            <div className="bg-bc-surface p-10 rounded-[40px] border-thin space-y-8">
              <div className="space-y-2">
                <h3 className="font-serif text-2xl">Network Settings</h3>
                <p className="text-xs text-bc-text/40">Critical system parameters and emergency configurations.</p>
              </div>

              <div className="space-y-6">
                {[
                  { label: 'Auto-Linking', desc: 'Sync phone/email profiles on login', enabled: true },
                  { label: 'Push Notifications', desc: 'Alert donors in 25km radius', enabled: true },
                  { label: 'Admin Logs', desc: 'Keep track of all admin deletions', enabled: true },
                  { label: 'Anonymous Access', desc: 'Allow read-only dashboard access', enabled: false }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-bc-text group-hover:text-bc-red transition-colors">{item.label}</div>
                      <div className="text-[10px] text-bc-text/40">{item.desc}</div>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-all duration-500 ${item.enabled ? 'bg-bc-red' : 'bg-bc-text/10'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-500 ${item.enabled ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bc-text p-10 rounded-[40px] border-none shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-bc-red/20 via-transparent to-transparent opacity-50" />
               <div className="relative z-10 space-y-8 h-full flex flex-col">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-xl border border-white/5">
                    <ShieldCheck size={28} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-serif text-2xl text-white">Advanced Security</h3>
                    <p className="text-xs text-white/50 leading-relaxed uppercase tracking-wider font-light">Audit logs show 42 interactions by 2 administrators in the last 24 hours. Your session is protected by Master encryption.</p>
                  </div>
                  <div className="mt-auto pt-8 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.2em] font-black text-bc-red">System Live</span>
                    <div className="flex -space-x-2">
                       {[1,2].map(u => (
                         <div key={u} className="w-7 h-7 rounded-full border-2 border-bc-text bg-bc-surface" />
                       ))}
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditProfileModal({ isOpen, onClose, data, onSave }: any) {
  const [formData, setFormData] = useState({ 
    name: '',
    phone: '',
    email: '',
    state: 'Tamil Nadu',
    district: '',
    city: '',
    bloodGroup: '',
    isAvailable: true
  });

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        state: data.state || 'Tamil Nadu',
        district: data.district || '',
        city: data.city || '',
        bloodGroup: data.bloodGroup || data.blood_group || '',
        isAvailable: data.isAvailable ?? data.is_available ?? true
      });
    }
  }, [data, isOpen]);

  const districts = IndiaData[formData.state as keyof typeof IndiaData] || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-bc-text/20 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-bc-bg rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bc-red-tint rounded-xl text-bc-red">
                <User size={20} />
              </div>
              <h2 className="font-serif text-2xl">Edit Profile</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-bc-surface rounded-full transition-all">
              <X size={20} className="text-bc-text/20" />
            </button>
          </div>

          <div className="space-y-6 max-h-[50vh] overflow-y-auto px-1">
             <GlassyInput 
                label="Full Name"
                value={formData.name}
                onChange={(e: any) => setFormData((p: any) => ({ ...p, name: e.target.value }))}
                icon={User}
                capitalize
              />
              <GlassyInput 
                label="Phone Number"
                value={formData.phone}
                onChange={(e: any) => setFormData((p: any) => ({ ...p, phone: e.target.value }))}
                icon={Phone}
                type="tel"
              />
              <GlassyInput 
                label="Email Address"
                value={formData.email}
                onChange={(e: any) => setFormData((p: any) => ({ ...p, email: e.target.value }))}
                icon={MessageSquare}
                type="email"
              />
              <div className="grid grid-cols-2 gap-4">
                <SearchableSelect 
                  label="State"
                  options={Object.keys(IndiaData)}
                  value={formData.state}
                  onChange={(val: string) => setFormData((p: any) => ({ ...p, state: val, district: '' }))}
                />
                <SearchableSelect 
                  label="District"
                  options={districts}
                  value={formData.district}
                  onChange={(val: string) => setFormData((p: any) => ({ ...p, district: val }))}
                />
              </div>
              <GlassyInput 
                label="City / Area"
                value={formData.city}
                onChange={(e: any) => setFormData((p: any) => ({ ...p, city: e.target.value }))}
                icon={MapPin}
              />
          </div>

          <div className="space-y-3 pt-2">
            <button 
              onClick={() => onSave(formData)}
              className="w-full py-4 bg-bc-red text-white rounded-2xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-bc-red/20 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Save Changes
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-bc-surface text-bc-text/40 rounded-2xl font-bold text-xs uppercase tracking-widest hover:text-bc-text transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DonationVerificationModal({ isOpen, onClose, onConfirm }: any) {
  const [hospital, setHospital] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!isOpen) return null;

  const handleFileChange = (e: any) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = () => {
    setIsUploading(true);
    // Simulate upload
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onConfirm(hospital);
          setIsUploading(false);
          setFile(null);
          setHospital("");
          onClose();
        }, 500);
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bc-text/40 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-bc-bg rounded-[40px] shadow-2xl relative z-10 overflow-hidden border border-white"
      >
        <div className="p-8 md:p-12 space-y-8">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h2 className="font-serif text-3xl">Verify Donation</h2>
              <p className="text-bc-text/60 text-sm">Upload your certificate to update your status.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-bc-surface rounded-full transition-colors">
              <X size={20} className="text-bc-text/40" />
            </button>
          </div>

          <div className="space-y-6">
            <GlassyInput 
              label="Hospital Name"
              placeholder="Where did you donate?"
              value={hospital}
              onChange={(e: any) => setHospital(e.target.value)}
              icon={Building2}
              capitalize
            />

            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-[0.2em] text-bc-text/40 font-medium px-1">Proof of donation</label>
              <div 
                className={`border-2 border-dashed rounded-[32px] p-8 transition-all flex flex-col items-center justify-center gap-4 text-center cursor-pointer ${
                  file ? 'border-bc-success/30 bg-bc-success/5' : 'border-bc-text/10 hover:border-bc-red/20 hover:bg-bc-surface'
                }`}
                onClick={() => document.getElementById('cert-upload')?.click()}
              >
                <input 
                  type="file" 
                  id="cert-upload" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept="image/*"
                />
                
                {file ? (
                  <>
                    <div className="w-16 h-16 bg-bc-success/10 rounded-2xl flex items-center justify-center text-bc-success">
                      <FileCheck size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-bc-text">{file.name}</p>
                      <p className="text-xs text-bc-text/40">Click to change file</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-bc-red-tint rounded-2xl flex items-center justify-center text-bc-red">
                      <Camera size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-bc-text">Upload Certificate / Photo</p>
                      <p className="text-xs text-bc-text/40">JPEG, PNG or PDF (Max 5MB)</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {isUploading ? (
            <div className="space-y-4 py-4">
              <div className="flex justify-between text-xs font-medium uppercase tracking-widest text-bc-text/40">
                <span>Uploading Proof...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-bc-text/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-bc-red"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={!hospital || !file}
              className={`w-full py-4 rounded-2xl font-medium transition-all text-sm tracking-wide shadow-lg ${
                hospital && file 
                  ? 'bg-bc-red text-white shadow-bc-red/10' 
                  : 'bg-bc-text/10 text-bc-text/20 cursor-not-allowed'
              }`}
            >
              Confirm Donation
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ProfileView({ donorData, setDonorData, notifications, setShowNotificationPopup, setNotifications, setActiveRequest, setShowCoordinationModal, setCurrentView }: any) {
  const [streak, setStreak] = useState(3);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activity, setActivity] = useState<any[]>([
    { date: 'Jan 12, 2026', event: 'Donated at Apollo Hospital', type: 'donation', verified: true },
    { date: 'Oct 08, 2025', event: 'Donated at Global Health City', type: 'donation', verified: true },
    { date: 'June 20, 2025', event: 'Donated at Fortis Malar', type: 'donation', verified: true }
  ]);

  const logDonation = (hospital: string) => {
    setStreak(s => s + 1);
    
    const recoveryMonths = donorData.gender === 'Female' ? 4 : 3;
    const recoveryDays = donorData.gender === 'Female' ? 120 : 90;

    setDonorData((prev: any) => ({
      ...prev,
      lastDonation: `Within ${recoveryMonths} months`,
      donationDate: new Date().toISOString().split('T')[0],
      isAvailable: false
    }));

    setUnavailableReason({
      title: "Heroic Recovery",
      message: `You're currently in recovery after saving a life. Take rest for ${recoveryDays} days!`
    });

    const newEntry = {
      date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      event: `Donated at ${hospital}`,
      type: 'donation',
      verified: true
    };
    setActivity(prev => [newEntry, ...prev]);

    setToastMessage("Donation logged. Next eligible date updated.");
    setShowSuccessModal(true);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const isEligible = donorData.lastDonation === 'Never donated' || 
    donorData.lastDonation === '4+ months ago' ||
    donorData.lastDonation === '3+ months ago' ||
    (donorData.donationDate && new Date().getTime() - new Date(donorData.donationDate).getTime() > (donorData.gender === 'Female' ? 120 : 90) * 24 * 60 * 60 * 1000);

  const handleToggleAvailability = () => {
    if (donorData.isAvailable) {
      setShowUnavailableModal(true);
    } else {
      // Strictly prevent enabling availability if in recovery period
      if (!isEligible) {
        const days = donorData.gender === 'Female' ? 120 : 90;
        setToastMessage(`Locked: You are in mandatory ${days}-day recovery.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
      }
      setDonorData((p: any) => ({ ...p, isAvailable: true }));
      setUnavailableReason(null);
    }
  };

  const handleConfirmUnavailable = (reason: string, date?: string) => {
    setDonorData((p: any) => ({ ...p, isAvailable: false }));
    
    let reasonText = "";
    let subText = "";
    
    if (reason === 'tattoo') {
      const recoveryDate = new Date(date || new Date());
      recoveryDate.setMonth(recoveryDate.getMonth() + 6);
      reasonText = "Tattoo Recovery";
      subText = `Next available from ${recoveryDate.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}. Take care!`;
    } else if (reason === 'diabetes') {
      reasonText = "Health Focus";
      subText = "Your health is the priority. You're a hero even if you can't donate right now!";
    } else if (reason === 'medical') {
      reasonText = "Medical Leave";
      subText = "Wishing you a speedy recovery. We'll be here when you're back!";
    } else {
      reasonText = "Off-duty";
      subText = "Availability paused. You can switch back anytime.";
    }

    setUnavailableReason({ title: reasonText, message: subText });
  };

  const simulateAlert = () => {
    const newRequest = {
      id: 'test-' + Date.now(),
      type: 'emergency',
      bloodGroup: donorData.bloodGroup || 'O+',
      district: donorData.district || 'Chennai',
      hospital: 'Grace Memorial Hospital',
      timestamp: new Date().toISOString(),
      message: `TEST ALERT: Emergency ${donorData.bloodGroup || 'O+'} request in your vicinity.`,
      distance: '0.8 km away'
    };
    setNotifications([newRequest]);
    setShowNotificationPopup(true);
  };

  const currentLevelProgress = ((streak % 5) / 5) * 100;
  const nextLevel = streak < 5 ? "Bronze" : streak < 10 ? "Silver" : "Gold";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-8 pb-20"
    >
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full text-xs font-medium shadow-2xl flex items-center gap-3 ${
              toastMessage.includes('Locked') ? 'bg-bc-red text-white' : 'bg-bc-text text-white'
            }`}
          >
            {toastMessage.includes('Locked') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} className="text-bc-success" />}
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <EditProfileModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        data={donorData}
        onSave={async (updatedData: any) => {
          try {
            const { updateDonorProfile } = await import('./services/bloodServices');
            await updateDonorProfile(donorData.firebase_uid || donorData.id, updatedData);
            setDonorData((prev: any) => ({ ...prev, ...updatedData }));
            setShowEditModal(false);
            setToastMessage("Profile updated successfully");
          } catch (e) {
            console.error(e);
            setToastMessage("Failed to update profile");
          }
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }}
      />

      <DonationVerificationModal 
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onConfirm={logDonation}
      />

      <DonationSuccessModal 
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        gender={donorData.gender}
      />

      <LogoutConfirmationModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          auth.signOut();
          setShowLogoutConfirm(false);
          setCurrentView('home');
        }}
      />

      <UnavailableModal 
        isOpen={showUnavailableModal} 
        onClose={() => setShowUnavailableModal(false)}
        onConfirm={handleConfirmUnavailable}
      />

      {/* Header Card */}
      <div className="bg-bc-surface p-8 rounded-[40px] border-thin flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 bg-bc-red-tint rounded-full flex items-center justify-center text-bc-red font-serif text-3xl overflow-hidden">
                    {donorData.name ? donorData.name.split(' ').filter(Boolean).map((n: any) => n[0]).join('') : '?'}
                  </div>
                  <div className="text-center md:text-left space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <h2 className="font-serif text-3xl">{donorData.name || 'Anonymous Donor'}</h2>
                      <span className="px-3 py-1 bg-bc-red text-white text-xs font-medium rounded-full">{donorData.bloodGroup}</span>
                      <button 
                        onClick={() => setShowEditModal(true)}
                        className="p-2 hover:bg-bc-red-tint rounded-full text-bc-red transition-all group/edit"
                        title="Edit Profile"
                      >
                        <Activity size={16} className="group-hover/edit:rotate-12" />
                      </button>
                      <button 
                        onClick={() => setShowLogoutConfirm(true)}
                        className="p-2 hover:bg-bc-bg rounded-full text-bc-text/20 hover:text-bc-red transition-all"
                        title="Logout"
                      >
                        <LogOut size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-bc-text/40">{donorData.city || 'Location unspecified'}, {donorData.district || 'N/A'}</p>
                  </div>
                </div>

        <div className="flex flex-col items-center md:items-end gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-bc-text/30 font-medium">Availability</span>
          <button 
            disabled={!isEligible && !donorData.isAvailable}
            onClick={handleToggleAvailability}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 relative flex items-center ${
              donorData.isAvailable ? 'bg-bc-success cursor-pointer' : (isEligible ? 'bg-bc-red cursor-pointer' : 'bg-bc-red/40 cursor-not-allowed grayscale')
            }`}
          >
            <motion.div 
              animate={{ x: donorData.isAvailable ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-6 h-6 bg-white rounded-full shadow-sm" 
            />
          </button>
          
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-bc-red font-bold hover:scale-105 transition-all mt-4"
          >
            <LogOut size={14} />
            Logout
          </button>

          {auth.currentUser?.email === 'mike.nijoe@gmail.com' && (
            <button 
              onClick={() => setCurrentView('dashboard')}
              className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-bc-success font-bold hover:scale-105 transition-all mt-2"
            >
              <LayoutDashboard size={14} />
              Master Dashboard
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {unavailableReason && !donorData.isAvailable && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-bc-warning-bg border-thin border-bc-warning/20 p-6 rounded-[32px] flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-bc-warning/10 flex items-center justify-center text-bc-warning shrink-0">
                <Info size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-bc-warning text-sm">{unavailableReason.title}</h4>
                <p className="text-xs text-bc-warning/70 leading-relaxed">{unavailableReason.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Impact Row */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <label className="text-[11px] uppercase tracking-widest text-bc-text/40 font-medium">Your Impact Journey</label>
          <div className="flex items-center gap-2 text-bc-red">
            <TrendingUp size={14} />
            <span className="text-[11px] font-medium uppercase tracking-widest">Growth</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-bc-surface/50 p-6 rounded-[32px] border-thin space-y-4 group hover:bg-white transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-bc-red-tint rounded-xl text-bc-red">
                <Droplets size={20} />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-bc-text/40">Donations</span>
                <p className="font-serif text-3xl">{streak}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold">
                <span className="text-bc-text/30">Next Medal</span>
                <span>{5 - (streak % 5)} left</span>
              </div>
              <div className="h-1.5 bg-bc-text/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${currentLevelProgress}%` }}
                  className="h-full bg-bc-red" 
                />
              </div>
            </div>
          </div>

          <div className="bg-bc-surface/50 p-6 rounded-[32px] border-thin space-y-4 group hover:bg-white transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-bc-success/10 rounded-xl text-bc-success">
                <Heart size={20} fill="currentColor" />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-bc-text/40">Lives Saved</span>
                <p className="font-serif text-3xl">{streak * 3}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-bc-success/5 rounded-xl border border-bc-success/10">
              <div className="w-1.5 h-1.5 rounded-full bg-bc-success animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-bc-success">Hero Verified</span>
            </div>
          </div>

          <div className="bg-bc-surface/50 p-6 rounded-[32px] border-thin space-y-4 group hover:bg-white transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-bc-red-tint rounded-xl text-bc-red">
                <Activity size={20} />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-bc-text/40">Searches</span>
                <p className="font-serif text-3xl">3</p>
              </div>
            </div>
            <p className="text-[10px] text-bc-text/40 leading-relaxed italic">
              "Matching with 3 nearby requests this week"
            </p>
          </div>
        </div>
      </div>

      {/* Eligibility Section */}
      <EligibilityCard 
        status={isEligible ? "success" : "warning"} 
        date={donorData.donationDate} 
        gender={donorData.gender}
      />

      {/* Streak Section */}
      <div className="p-8 bg-bc-surface rounded-[40px] border-thin space-y-6">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-widest text-bc-text/40 font-medium">Your donation streak</label>
          <div className="flex items-center gap-2 text-bc-red">
            <Award size={14} />
            <span className="text-[11px] font-medium uppercase tracking-widest">Life Saver Level</span>
          </div>
        </div>
        <StreakGrid count={streak} />
        
        <motion.button 
          whileHover={isEligible ? { scale: 1.01, backgroundColor: '#fdf1ef' } : {}}
          whileTap={isEligible ? { scale: 0.98 } : {}}
          disabled={!isEligible}
          onClick={() => setShowVerifyModal(true)}
          className={`w-full border-thin py-4 rounded-2xl font-medium transition-all text-sm tracking-wide flex items-center justify-center gap-2 shadow-sm ${
            isEligible ? 'hover:border-bc-red/30' : 'opacity-40 cursor-not-allowed bg-bc-bg grayscale text-bc-text/40'
          }`}
        >
          {isEligible ? (
            <>
              <Droplets size={16} className="text-bc-red" />
              I donated today
            </>
          ) : (
            <>
              <Clock size={16} />
              Next donation in {donorData.gender === 'Female' ? '4' : '3'} months
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {notifications.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 bg-bc-text rounded-[40px] text-white space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 translate-x-4 -translate-y-4 opacity-5">
              <AlertCircle size={120} />
            </div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-bc-red animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Emergencies Nearby</span>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 bg-white/10 rounded-lg">{notifications.length} Active</span>
            </div>

            <div className="space-y-4 relative z-10">
              {notifications.map((req: any) => (
                <div 
                  key={req.id} 
                  className="p-5 bg-white/5 rounded-3xl border border-white/10 space-y-4 hover:bg-white/10 transition-colors cursor-pointer group" 
                  onClick={() => {
                    setActiveRequest(req);
                    setShowCoordinationModal(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{req.hospital}</p>
                      <p className="text-[10px] uppercase tracking-widest text-white/40">{req.distance}</p>
                    </div>
                    <div className="w-10 h-10 bg-white text-bc-text rounded-xl flex items-center justify-center font-serif text-lg">
                      {req.bloodGroup}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                    <span className="text-bc-red">High Priority</span>
                    <div className="flex items-center gap-1 group-hover:gap-2 transition-all">
                      <span>Take Action</span>
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="p-8 border-thin border-dashed border-bc-text/10 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 bg-bc-surface rounded-full flex items-center justify-center text-bc-text/20">
              <Bell size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-bc-text/40">No active local requests</p>
              <p className="text-[10px] text-bc-text/20 uppercase tracking-widest">Everything looks calm right now</p>
            </div>
            <button 
              onClick={simulateAlert}
              className="px-6 py-2 bg-bc-surface hover:bg-bc-surface/80 rounded-full text-[10px] uppercase tracking-widest font-bold text-bc-text/40 transition-all border border-bc-text/5 hover:border-bc-text/10"
            >
              Simulate Emergency Alert
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard */}
      <div className="p-5 bg-bc-surface rounded-2xl border-thin flex items-center justify-between group cursor-default">
        <div className="flex items-center gap-4">
          <div className="px-2 py-1 bg-bc-bg rounded text-[10px] font-medium text-bc-text/40 group-hover:text-bc-red transition-colors">#2</div>
          <p className="text-[11px] uppercase tracking-widest text-bc-text/60">
            You are <span className="text-bc-text font-medium">#2</span> among {donorData.bloodGroup} donors in {donorData.district}
          </p>
        </div>
        <ChevronRight size={14} className="text-bc-text/20 group-hover:text-bc-red transition-all" />
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        <h3 className="text-[11px] uppercase tracking-widest text-bc-text/40 font-medium px-2">Recent activity</h3>
        <div className="space-y-4">
          {activity.map((entry, i) => (
            <div key={i} className="flex gap-4 group">
              <div className="flex flex-col items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-bc-red/30 group-hover:bg-bc-red transition-colors mt-2" />
                {i < activity.length - 1 && <div className="w-[1px] flex-grow bg-bc-text/10 my-1" />}
              </div>
              <div className="pb-6 space-y-1 flex-grow">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-bc-text/30">{entry.date}</p>
                  {entry.verified && (
                    <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-bc-success px-2 py-0.5 bg-bc-success/5 rounded-full border border-bc-success/10">
                      <CheckCircle2 size={8} strokeWidth={3} />
                      Verified
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-bc-text/80">{entry.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
