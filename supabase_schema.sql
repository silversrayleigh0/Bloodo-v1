-- BloodConnect Supabase Schema
-- Senior Backend Developer / Database Architect
-- Date: 2026-04-22

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 65),
    gender TEXT,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT,
    is_available BOOLEAN DEFAULT true NOT NULL,
    snoozed_until TIMESTAMP WITH TIME ZONE,
    last_donated_at TIMESTAMP WITH TIME ZONE,
    total_donations INTEGER DEFAULT 0 NOT NULL,
    search_appearances INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Table: requests
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_name TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    blood_group TEXT NOT NULL,
    units_required INTEGER NOT NULL,
    required_on DATE NOT NULL,
    reason TEXT,
    hospital_name TEXT,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open','contacted','fulfilled','expired','cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: contacts_log
CREATE TABLE contacts_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID REFERENCES users(id),
    request_id UUID REFERENCES requests(id),
    revealed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Core Functions

-- 1. Register Donor
CREATE OR REPLACE FUNCTION register_donor(
    p_firebase_uid TEXT,
    p_name TEXT,
    p_phone TEXT,
    p_age INTEGER,
    p_gender TEXT,
    p_blood_group TEXT,
    p_state TEXT,
    p_district TEXT,
    p_city TEXT,
    p_last_donated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS SETOF users AS $$
BEGIN
    -- Uniqueness checks handled by table constraints, but we can catch them here
    RETURN QUERY
    INSERT INTO users (
        firebase_uid, name, phone, age, gender, blood_group, state, district, city, last_donated_at
    ) VALUES (
        p_firebase_uid, p_name, p_phone, p_age, p_gender, p_blood_group, p_state, p_district, p_city, p_last_donated_at
    ) RETURNING *;
EXCEPTION WHEN unique_violation THEN
    IF SQUEEZE(SQLERRM) LIKE '%firebase_uid%' THEN
        RAISE EXCEPTION 'Account already exists';
    ELSIF SQUEEZE(SQLERRM) LIKE '%phone%' THEN
        RAISE EXCEPTION 'Phone number already registered';
    ELSE
        RAISE EXCEPTION 'Unique violation: %', SQLERRM;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Availability
CREATE OR REPLACE FUNCTION update_availability(
    p_firebase_uid TEXT,
    p_is_available BOOLEAN,
    p_snooze_days INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_snoozed_until TIMESTAMP WITH TIME ZONE := NULL;
BEGIN
    IF p_is_available = false AND p_snooze_days IS NOT NULL THEN
        v_snoozed_until := now() + (p_snooze_days || ' days')::interval;
    END IF;

    UPDATE users 
    SET is_available = p_is_available,
        snoozed_until = v_snoozed_until
    WHERE firebase_uid = p_firebase_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Log Donation
CREATE OR REPLACE FUNCTION log_donation(
    p_firebase_uid TEXT,
    p_donated_at TIMESTAMP WITH TIME ZONE
) RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET last_donated_at = p_donated_at,
        total_donations = total_donations + 1,
        is_available = false
    WHERE firebase_uid = p_firebase_uid
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Eligibility Check
CREATE OR REPLACE FUNCTION is_eligible(p_last_donated_at TIMESTAMP WITH TIME ZONE)
RETURNS TABLE(eligible BOOLEAN, days_remaining INTEGER) AS $$
DECLARE
    v_days INTEGER;
BEGIN
    IF p_last_donated_at IS NULL THEN
        RETURN QUERY SELECT true, 0;
    ELSE
        v_days := EXTRACT(DAY FROM (now() - p_last_donated_at));
        IF v_days >= 90 THEN
            RETURN QUERY SELECT true, 0;
        ELSE
            RETURN QUERY SELECT false, (90 - v_days)::INTEGER;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Search Donors (Matching Rings)
CREATE OR REPLACE FUNCTION search_donors(
    needed_blood_group TEXT,
    search_district TEXT,
    search_state TEXT
) RETURNS TABLE(
    id UUID, 
    name TEXT, 
    blood_group TEXT, 
    city TEXT, 
    district TEXT, 
    is_available BOOLEAN, 
    last_donated_at TIMESTAMP WITH TIME ZONE, 
    total_donations INTEGER, 
    ring_label TEXT
) AS $$
BEGIN
    -- Ring 1: Exact Match, Same District
    RETURN QUERY
    WITH r1 AS (
        SELECT u.id, u.name, u.blood_group, u.city, u.district, u.is_available, u.last_donated_at, u.total_donations, 'exact_match_same_district'::TEXT as ring_label
        FROM users u
        WHERE u.district = search_district 
          AND u.blood_group = needed_blood_group 
          AND u.is_available = true 
          AND (check_el := is_eligible(u.last_donated_at)).eligible = true
        ORDER BY u.total_donations DESC
    )
    SELECT * FROM r1;

    -- If Ring 1 has data, stop
    IF FOUND THEN
        -- Increment search_appearances for Ring 1 donors (simplified for SQL example)
        UPDATE users SET search_appearances = search_appearances + 1 WHERE id IN (SELECT r1.id FROM r1);
        RETURN;
    END IF;

    -- Ring 2: Compatible Match, Same District
    RETURN QUERY
    WITH compatible AS (
        SELECT unnest(CASE 
            WHEN needed_blood_group = 'A+' THEN ARRAY['A+','A-','O+','O-']
            WHEN needed_blood_group = 'A-' THEN ARRAY['A-','O-']
            WHEN needed_blood_group = 'B+' THEN ARRAY['B+','B-','O+','O-']
            WHEN needed_blood_group = 'B-' THEN ARRAY['B-','O-']
            WHEN needed_blood_group = 'AB+' THEN ARRAY['A+','A-','B+','B-','O+','O-','AB+','AB-']
            WHEN needed_blood_group = 'AB-' THEN ARRAY['AB-','A-','B-','O-']
            WHEN needed_blood_group = 'O+' THEN ARRAY['O+','O-']
            WHEN needed_blood_group = 'O-' THEN ARRAY['O-']
            ELSE ARRAY[needed_blood_group]
        END) as bg
    ),
    r2 AS (
        SELECT u.id, u.name, u.blood_group, u.city, u.district, u.is_available, u.last_donated_at, u.total_donations, 'compatible_same_district'::TEXT as ring_label
        FROM users u
        WHERE u.district = search_district 
          AND u.blood_group IN (SELECT bg FROM compatible)
          AND u.is_available = true 
          AND (SELECT eligible FROM is_eligible(u.last_donated_at)) = true
        ORDER BY u.total_donations DESC
    )
    SELECT * FROM r2;

    IF FOUND THEN
        RETURN;
    END IF;

    -- Ring 3: Exact Match, Adjacent District
    RETURN QUERY
    WITH adjacent AS (
        SELECT unnest(CASE 
            -- Tamil Nadu
            WHEN search_district = 'Chennai' THEN ARRAY['Tiruvallur', 'Kanchipuram', 'Chengalpattu']
            WHEN search_district = 'Coimbatore' THEN ARRAY['Tiruppur', 'Erode', 'Nilgiris', 'Dindigul']
            WHEN search_district = 'Madurai' THEN ARRAY['Dindigul', 'Theni', 'Virudhunagar', 'Sivaganga', 'Ramanathapuram']
            WHEN search_district = 'Salem' THEN ARRAY['Namakkal', 'Erode', 'Dharmapuri', 'Krishnagiri']
            WHEN search_district = 'Tiruchirappalli' THEN ARRAY['Karur', 'Perambalur', 'Ariyalur', 'Thanjavur', 'Pudukkottai', 'Dindigul']
            -- Kerala
            WHEN search_district = 'Thiruvananthapuram' THEN ARRAY['Kollam']
            WHEN search_district = 'Kollam' THEN ARRAY['Thiruvananthapuram', 'Pathanamthitta', 'Alappuzha']
            WHEN search_district = 'Ernakulam' THEN ARRAY['Thrissur', 'Idukki', 'Kottayam', 'Alappuzha']
            WHEN search_district = 'Kozhikode' THEN ARRAY['Malappuram', 'Wayanad', 'Kannur']
            -- Karnataka
            WHEN search_district = 'Bengaluru Urban' THEN ARRAY['Bengaluru Rural', 'Tumakuru', 'Ramanagara', 'Chikkaballapur', 'Kolar']
            WHEN search_district = 'Mysuru' THEN ARRAY['Mandya', 'Chamarajanagar', 'Kodagu', 'Hassan']
            -- Maharashtra
            WHEN search_district = 'Mumbai City' THEN ARRAY['Mumbai Suburban', 'Thane']
            WHEN search_district = 'Pune' THEN ARRAY['Raigad', 'Satara', 'Ahmednagar', 'Solapur']
            -- Delhi (All adjacent)
            WHEN search_state = 'Delhi' THEN (SELECT array_agg(DISTINCT u2.district) FROM users u2 WHERE u2.state = 'Delhi' AND u2.district != search_district)
            -- Telangana
            WHEN search_district = 'Hyderabad' THEN ARRAY['Ranga Reddy', 'Medchal–Malkajgiri', 'Sangareddy', 'Yadadri Bhuvanagiri']
            -- Andhra Pradesh
            WHEN search_district = 'Visakhapatnam' THEN ARRAY['Vizianagaram', 'Anakapalli', 'Alluri Sitharama Raju']
            ELSE ARRAY[]::TEXT[]
        END) as dist
    ),
    r3 AS (
        SELECT u.id, u.name, u.blood_group, u.city, u.district, u.is_available, u.last_donated_at, u.total_donations, 'exact_match_adjacent_district'::TEXT as ring_label
        FROM users u
        WHERE u.district IN (SELECT dist FROM adjacent)
          AND u.blood_group = needed_blood_group 
          AND u.is_available = true 
          AND (SELECT eligible FROM is_eligible(u.last_donated_at)) = true
        ORDER BY u.total_donations DESC
    )
    SELECT * FROM r3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Reveal Contact
CREATE OR REPLACE FUNCTION reveal_contact(p_donor_id UUID, p_request_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_phone TEXT;
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM requests WHERE id = p_request_id;
    
    IF v_status NOT IN ('open', 'contacted') THEN
        RAISE EXCEPTION 'Request is no longer active';
    END IF;

    SELECT phone INTO v_phone FROM users WHERE id = p_donor_id;
    
    INSERT INTO contacts_log (donor_id, request_id) VALUES (p_donor_id, p_request_id);
    UPDATE users SET search_appearances = search_appearances + 1 WHERE id = p_donor_id;

    RETURN v_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own record" ON users FOR SELECT USING (auth.uid()::text = firebase_uid);
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (auth.uid()::text = firebase_uid);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert requests" ON requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Requesters can update own requests" ON requests FOR UPDATE USING (requester_phone = requester_phone); -- Simple phone match logic
CREATE POLICY "Donors can read open requests" ON requests FOR SELECT USING (status = 'open');

ALTER TABLE contacts_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donors can read own logs" ON contacts_log FOR SELECT USING (donor_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text));

-- Indexes
CREATE INDEX idx_users_search ON users(district, blood_group, is_available);
CREATE INDEX idx_users_uid ON users(firebase_uid);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_requests_district ON requests(status, district);
CREATE INDEX idx_contacts_donor ON contacts_log(donor_id);
