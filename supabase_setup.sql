-- BloodConnect Supabase Database Schema
-- Production-ready SQL for Supabase Postgres

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Users Table (Donors)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    age INTEGER CHECK (age >= 18),
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    role TEXT DEFAULT 'donor' CHECK (role IN ('donor', 'master_admin')),
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT,
    is_available BOOLEAN DEFAULT true,
    snoozed_until TIMESTAMP WITH TIME ZONE NULL,
    last_donated_at TIMESTAMP WITH TIME ZONE NULL,
    total_donations INTEGER DEFAULT 0,
    search_appearances INTEGER DEFAULT 0,
    firebase_uid TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospitals Table
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Requests Table
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_name TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
    units_required INTEGER NOT NULL CHECK (units_required > 0),
    required_on DATE NOT NULL,
    reason TEXT,
    hospital_name TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT,
    posted_by TEXT DEFAULT 'public' CHECK (posted_by IN ('public', 'hospital')),
    hospital_id UUID REFERENCES hospitals(id),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'contacted', 'fulfilled', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches Table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'no_response')),
    notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('blood_request', 'request_accepted', 'eligibility_reminder', 'monthly_ping', 'streak_updated', 'request_fulfilled')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    related_request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Users Table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adjacency Lookup Table
CREATE TABLE district_adjacency (
    district_a TEXT NOT NULL,
    district_b TEXT NOT NULL,
    PRIMARY KEY (district_a, district_b)
);

-- 3. ROW LEVEL SECURITY (RLS) policies

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Master Admin Policy (Universal Bypass via Role)
CREATE POLICY master_admin_bypass ON users TO authenticated USING (auth.uid() IN (SELECT id FROM admin_users));

-- Users (Donors) Policies
CREATE POLICY donor_read_own ON users FOR SELECT TO authenticated USING (auth.uid()::text = firebase_uid OR auth.uid() = id);
CREATE POLICY donor_update_own ON users FOR UPDATE TO authenticated USING (auth.uid()::text = firebase_uid) WITH CHECK (auth.uid()::text = firebase_uid);

-- Public Search Policy (Modified per request)
-- name, blood_group, district, city, is_available, last_donated_at, phone
CREATE POLICY public_search_donors ON users FOR SELECT TO anon, authenticated 
USING (
    true -- Allow seeing rows for search
);
-- Note: Phone number visibility control is best handled at the application layer or via views if RLS column-masking isn't available.
-- However, we can use a VIEW for searching and apply RLS to the view.

-- Hospitals Policies
CREATE POLICY hospital_read_own ON hospitals FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY hospital_update_own ON hospitals FOR UPDATE TO authenticated USING (id = auth.uid());

-- Requests Policies
CREATE POLICY hospital_read_their_requests ON requests FOR SELECT TO authenticated USING (hospital_id = auth.uid());
CREATE POLICY public_read_requests ON requests FOR SELECT TO anon, authenticated USING (posted_by = 'public' OR status = 'open');

-- Notifications Policies
CREATE POLICY donor_read_own_notifications ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Matches Policies
CREATE POLICY donor_read_own_matches ON matches FOR SELECT TO authenticated USING (donor_id = auth.uid());

-- 4. FUNCTIONS

-- Eligibility Check
CREATE OR REPLACE FUNCTION is_eligible(last_donated_at timestamp with time zone)
RETURNS boolean AS $$
BEGIN
    RETURN last_donated_at IS NULL OR last_donated_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Nearby Donors
CREATE OR REPLACE FUNCTION nearby_donors(needed_group text, target_district text)
RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM users
    WHERE blood_group = needed_group
      AND district = target_district
      AND is_available = true
      AND is_eligible(last_donated_at)
    ORDER BY total_donations DESC;
END;
$$ LANGUAGE plpgsql;

-- Compatible Donors
CREATE OR REPLACE FUNCTION compatible_donors(needed_group text, target_district text)
RETURNS SETOF users AS $$
DECLARE
    compatibility_map JSONB := '{
        "A+": ["A+", "A-", "O+", "O-"],
        "A-": ["A-", "O-"],
        "B+": ["B+", "B-", "O+", "O-"],
        "B-": ["B-", "O-"],
        "AB+": ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
        "AB-": ["AB-", "A-", "B-", "O-"],
        "O+": ["O+", "O-"],
        "O-": ["O-"]
    }';
    allowed_groups TEXT[];
BEGIN
    allowed_groups := ARRAY(SELECT jsonb_array_elements_text(compatibility_map->needed_group));
    
    RETURN QUERY
    SELECT * FROM users
    WHERE blood_group = ANY(allowed_groups)
      AND district = target_district
      AND is_available = true
      AND is_eligible(last_donated_at)
    ORDER BY total_donations DESC;
END;
$$ LANGUAGE plpgsql;

-- Adjacent Donors
CREATE OR REPLACE FUNCTION adjacent_donors(needed_group text, target_district text, target_state text)
RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY
    SELECT u.* FROM users u
    JOIN district_adjacency adj ON (adj.district_a = target_district AND adj.district_b = u.district) 
                                OR (adj.district_b = target_district AND adj.district_a = u.district)
    WHERE u.blood_group = needed_group
      AND u.state = target_state
      AND u.is_available = true
      AND is_eligible(u.last_donated_at)
    ORDER BY u.total_donations DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGERS

-- Trigger: Notification when match is accepted
CREATE OR REPLACE FUNCTION notify_on_match_accepted()
RETURNS TRIGGER AS $$
DECLARE
    requester_user_id UUID;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted') THEN
        -- Find who posted the request
        -- If it was a hospital, we notify the hospital admin (this logic can be adjusted to linked users)
        -- For now, we simulate notification logic. In a real app, requests might have a 'creator_id'.
        -- Since requests table has requester_phone, we might need a lookup for user_id.
        INSERT INTO notifications (user_id, type, title, message, related_request_id)
        SELECT u.id, 'request_accepted', 'Donor Found!', 'A donor has accepted your blood request for ' || r.blood_group, NEW.request_id
        FROM requests r
        JOIN users u ON u.phone = r.requester_phone
        WHERE r.id = NEW.request_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_match_accepted
AFTER UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION notify_on_match_accepted();

-- Trigger: Donation Milestones
CREATE OR REPLACE FUNCTION notify_on_donation_streak()
RETURNS TRIGGER AS $$
DECLARE
    milestone_msg TEXT;
BEGIN
    IF (NEW.total_donations > OLD.total_donations) THEN
        milestone_msg := CASE 
            WHEN NEW.total_donations = 1 THEN 'Congratulations on your first donation! You are a hero.'
            WHEN NEW.total_donations = 3 THEN 'Triple Life Saver! You have hit the 3-donation milestone.'
            WHEN NEW.total_donations = 6 THEN 'Silver Donor Status! 6 lives impacted.'
            WHEN NEW.total_donations = 12 THEN 'Gold Donor Status! You are a BloodConnect legend.'
            ELSE NULL
        END;

        IF milestone_msg IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (NEW.id, 'streak_updated', 'New Milestone Unlocked!', milestone_msg);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_donation_streak
AFTER UPDATE OF total_donations ON users
FOR EACH ROW EXECUTE FUNCTION notify_on_donation_streak();

-- Trigger: Fulfilled Request
CREATE OR REPLACE FUNCTION notify_on_fulfillment()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'fulfilled' AND OLD.status != 'fulfilled') THEN
        -- Notify the requester
        INSERT INTO notifications (user_id, type, title, message, related_request_id)
        SELECT u.id, 'request_fulfilled', 'Request Fulfilled', 'Thank you! Your blood request has been marked as fulfilled.', NEW.id
        FROM users u WHERE u.phone = NEW.requester_phone;

        -- Notify the accepted donor
        INSERT INTO notifications (user_id, type, title, message, related_request_id)
        SELECT donor_id, 'request_fulfilled', 'Mission Accomplished', 'The request you supported has been fulfilled. Thank you for your service!', NEW.id
        FROM matches WHERE request_id = NEW.id AND status = 'accepted';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_request_fulfilled
AFTER UPDATE OF status ON requests
FOR EACH ROW EXECUTE FUNCTION notify_on_fulfillment();

-- Trigger: Eligibility Reminder
CREATE OR REPLACE FUNCTION schedule_eligibility_reminder()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.last_donated_at IS DISTINCT FROM OLD.last_donated_at AND NEW.last_donated_at IS NOT NULL) THEN
        -- We insert the notification with a 'created_at' in the future
        -- NOTE: This requires the application to filter by created_at <= NOW()
        -- or use Supabase edge functions / pg_cron for actual scheduling.
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES (
            NEW.id, 
            'eligibility_reminder', 
            'You are eligible again!', 
            'It has been 90 days since your last donation. Someone might need your help today.',
            NEW.last_donated_at + INTERVAL '90 days'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_eligibility_reminder
AFTER UPDATE OF last_donated_at ON users
FOR EACH ROW EXECUTE FUNCTION schedule_eligibility_reminder();

-- 6. INDEXES
CREATE INDEX idx_users_search ON users (district, blood_group, is_available);
CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);
CREATE INDEX idx_requests_filter ON requests (status, district);
CREATE INDEX idx_matches_request ON matches (request_id);
CREATE INDEX idx_matches_donor ON matches (donor_id);
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);

-- 7. ADJACENCY DATA (Tamil Nadu Sample)
INSERT INTO district_adjacency (district_a, district_b) VALUES 
('Chennai', 'Tiruvallur'), ('Chennai', 'Kanchipuram'), ('Chennai', 'Chengalpattu'),
('Coimbatore', 'Tiruppur'), ('Coimbatore', 'Erode'), ('Coimbatore', 'Nilgiris'),
('Madurai', 'Dindigul'), ('Madurai', 'Theni'), ('Madurai', 'Virudhunagar'), ('Madurai', 'Sivaganga');
-- (Additional data for other states would follow this pattern)
