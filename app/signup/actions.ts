"use server";

import { createAdminSupabase } from "@/lib/supabaseAdmin";

// Public self-service merchant signup. Runs entirely on the server via
// the service-role admin client because:
//   - creating an auth user requires admin privileges (`auth.admin.*`)
//   - `restaurant_users` RLS would otherwise block the initial insert
//     (the user has no membership row to authorize themselves yet)
//   - `stores` RLS is owner-only-after-link; same chicken-and-egg
//
// Four database writes happen in sequence. Any failure rolls back
// everything we already created so we never leave a half-built
// account dangling:
//
//   1. auth.users         (admin createUser, email_confirm=true)
//   2. profiles           (role='restaurant', full_name=restaurantName)
//   3. stores             (name + onboarding_status='not_started' +
//                          is_approved=false + placeholder
//                          category/address/lat/lng — filled in by
//                          F.3 business-info step)
//   4. restaurant_users   (role='owner', is_active=true, accepted_at=now)

export type SignUpResult =
  | { ok: true; userId: string; storeId: string }
  | { ok: false; error: string };

type Input = {
  email: string;
  password: string;
  restaurantName: string;
};

const PLACEHOLDER_LAT = 0;
const PLACEHOLDER_LNG = 0;
const PLACEHOLDER_ADDRESS = "Pending onboarding";
// stores_category_check restricts category to the lowercase set
// ('food','grocery','pharmacy','coffee','dessert','other'). 'other'
// is the neutral pre-onboarding placeholder; the real cuisine value
// is collected later as restaurant_signups.operations_info.cuisine_type
// in F.4 (which is independent of stores.category — they're separate
// columns).
const PLACEHOLDER_CATEGORY = "other";

export async function signUpRestaurant(input: Input): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const restaurantName = input.restaurantName.trim();

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (!restaurantName) {
    return { ok: false, error: "Restaurant name is required." };
  }

  const admin = createAdminSupabase();

  // ── 1. Create auth.users ────────────────────────────────────────────
  // email_confirm=true so the merchant can sign in immediately without
  // going through a confirmation email — registration is meant to flow
  // straight into the onboarding wizard.
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { signup_source: "merchant_portal_self_serve" },
  });
  if (authErr || !authData?.user?.id) {
    // Most common reason: account already exists. Surface a clean message
    // rather than the raw Supabase string.
    const msg = authErr?.message ?? "Could not create account.";
    if (/already/i.test(msg) || /registered/i.test(msg)) {
      return { ok: false, error: "An account with this email already exists. Try signing in instead." };
    }
    return { ok: false, error: msg };
  }
  const userId = authData.user.id;

  // ── 2. profiles ─────────────────────────────────────────────────────
  // profiles has no auto-create trigger on auth.users in this project;
  // the row has to be inserted manually. role='restaurant' is what the
  // F.1 migration / checkPartnerAccess pipeline expects upstream.
  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    role: "restaurant",
    full_name: restaurantName,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Could not create profile: ${profileErr.message}` };
  }

  // ── 3. stores ───────────────────────────────────────────────────────
  // Placeholder address/lat/lng/category satisfy NOT NULL constraints;
  // the business-info step (F.3) overwrites address; future geocoding
  // will fill lat/lng. is_approved=false gates the F.8 pending screen
  // until admin reviews and approves. is_active=false keeps the store
  // out of customer-app search results until then.
  const { data: storeData, error: storeErr } = await admin
    .from("stores")
    .insert({
      name: restaurantName,
      category: PLACEHOLDER_CATEGORY,
      address: PLACEHOLDER_ADDRESS,
      lat: PLACEHOLDER_LAT,
      lng: PLACEHOLDER_LNG,
      owner_email: email,
      onboarding_status: "not_started",
      is_approved: false,
      is_active: false,
    })
    .select("id")
    .single();
  if (storeErr || !storeData?.id) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Could not create store: ${storeErr?.message ?? "unknown"}` };
  }
  const storeId = storeData.id;

  // ── 4. restaurant_users link ────────────────────────────────────────
  // role='owner' is required for the F.1 owner-only onboarding actions
  // + checkPartnerAccess to recognize this user as the store owner.
  // accepted_at=now() because the user accepted by signing up — there's
  // no invite to confirm.
  const { error: linkErr } = await admin.from("restaurant_users").insert({
    user_id: userId,
    store_id: storeId,
    role: "owner",
    is_active: true,
    accepted_at: new Date().toISOString(),
  });
  if (linkErr) {
    await admin.from("stores").delete().eq("id", storeId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Could not link user to store: ${linkErr.message}` };
  }

  return { ok: true, userId, storeId };
}
