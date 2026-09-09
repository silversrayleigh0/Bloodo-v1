# BloodConnect Security Specification

## 1. Data Invariants
- A **User** profile must match the authenticated `uid`. Once created, the `firebase_uid` and `phone` are immutable.
- A **Blood Request** must have a valid `posted_by` type and a future `required_on` date (simulated).
- A **Match** cannot exist without a valid `request_id` and `donor_id`.
- Users can only read their own private PII (not implemented yet, but keeping in mind).

## 2. The "Dirty Dozen" Payloads (Attack Vectors)
1. **Identity Spoofing**: Create a user document with a `userId` different from `auth.uid`.
2. **Phone Hijacking**: Update another user's phone number.
3. **Admin Escalation**: Setting `role: 'admin'` on own profile.
4. **Shadow Fields**: Adding `is_verified: true` to a request.
5. **Orphaned Match**: Creating a match for a non-existent request.
6. **Denial of Wallet**: Sending a 1MB string as the `name` field.
7. **Time Travel**: Creating a `created_at` timestamp in the past/future (not server-time).
8. **Malicious ID**: Creating a document with ID `../../secrets`.
9. **Status Jumping**: Updating a request status directly to `fulfilled` without being the owner.
10. **Anonymous Spam**: Creating 1000 requests as an unverified guest (rate limiting simulated by rules).
11. **PII Leak**: Querying the `users` collection to scrape all phone numbers (List query restriction).
12. **Double Delete**: Deleting someone else's profile during migration.

## 3. Test Runner (Draft Logic)
- Verify `create` on `/users/{uid}` returns `200`.
- Verify `create` on `/users/{otherUid}` returns `403`.
- Verify `delete` on `/users/{existingId}` returns `200` only if the logic verifies the phone (relational check not possible in rules directly, so we allow owner or admin).
