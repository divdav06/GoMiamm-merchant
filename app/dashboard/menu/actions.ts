"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

// Server actions for the merchant menu surface. Each one:
//   1. Verifies the caller via checkPartnerAccess (cookie-bridged JWT
//      → restaurant_users.is_active=true).
//   2. Enforces the caller's storeId on every write — even when the
//      form passes a different store_id, we override with the
//      authenticated one so a manager of store A can't mutate
//      menu_items for store B.
//   3. Uses the service-role client (createAdminSupabase) so RLS on
//      menu_items doesn't block writes the caller is already
//      authorized for.

const MENU_PHOTO_BUCKET = "menu-photos";

function requireAuthed() {
  return checkPartnerAccess().then((access) => {
    if (!access) throw new Error("Unauthorized");
    return access;
  });
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  return "jpg";
}

// Upload a file to menu-photos and return its public URL. Path is
// pinned to <storeId>/<menuItemId>/<uuid>.<ext> so a manager from
// another store can never overwrite this store's photos even if the
// service key were exposed.
async function uploadMenuPhoto(
  storeId: string,
  itemId: string | null,
  file: File,
): Promise<string> {
  const admin = createAdminSupabase();
  const idSegment = itemId ?? "new";
  const path = `${storeId}/${idSegment}/${crypto.randomUUID()}.${extFor(file.type)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(MENU_PHOTO_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw error;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${supabaseUrl}/storage/v1/object/public/${MENU_PHOTO_BUCKET}/${path}`;
}

function parsePriceCents(raw: FormDataEntryValue | null): number {
  const cents = Number(raw);
  if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(cents)) {
    throw new Error("Price must be a positive integer (cents).");
  }
  return cents;
}

// Returns the new item's id so the modal can attach option groups in a
// follow-up setMenuItemOptions call.
export async function createMenuItem(form: FormData): Promise<string> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const category = String(form.get("category") ?? "").trim() || null;
  const priceCents = parsePriceCents(form.get("price_cents"));
  const isAvailable = form.get("is_available") === "on" || form.get("is_available") === "true";
  if (!name) throw new Error("Name required");

  const photo = form.get("photo");
  let imageUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    imageUrl = await uploadMenuPhoto(access.storeId, null, photo);
  }

  // Schema stores price as numeric dollars (customer-app reads it as
  // such — see customer-app/app/store/[id].tsx). The form gives us
  // cents; divide before persisting.
  const priceDollars = priceCents / 100;

  const { data, error } = await admin
    .from("menu_items")
    .insert({
      store_id: access.storeId,
      name,
      description,
      category,
      price: priceDollars,
      image_url: imageUrl,
      is_available: isAvailable,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/dashboard/menu");
  return data.id as string;
}

export async function updateMenuItem(itemId: string, form: FormData): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  // Verify the item belongs to the caller's store before any mutation.
  const { data: existing, error: fetchErr } = await admin
    .from("menu_items")
    .select("id, store_id, image_url")
    .eq("id", itemId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error("Item not found");
  if (existing.store_id !== access.storeId) {
    throw new Error("Item belongs to another store");
  }

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const category = String(form.get("category") ?? "").trim() || null;
  const priceCents = parsePriceCents(form.get("price_cents"));
  const isAvailable = form.get("is_available") === "on" || form.get("is_available") === "true";
  if (!name) throw new Error("Name required");

  let imageUrl: string | null = existing.image_url;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    imageUrl = await uploadMenuPhoto(access.storeId, itemId, photo);
  }

  const { error } = await admin
    .from("menu_items")
    .update({
      name,
      description,
      category,
      price: priceCents / 100,
      image_url: imageUrl,
      is_available: isAvailable,
    })
    .eq("id", itemId);
  if (error) throw error;

  revalidatePath("/dashboard/menu");
}

export async function toggleAvailability(itemId: string, next: boolean): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: existing, error: fetchErr } = await admin
    .from("menu_items")
    .select("id, store_id")
    .eq("id", itemId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing || existing.store_id !== access.storeId) {
    throw new Error("Item not found for this store");
  }

  const { error } = await admin
    .from("menu_items")
    .update({ is_available: next })
    .eq("id", itemId);
  if (error) throw error;

  revalidatePath("/dashboard/menu");
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: existing, error: fetchErr } = await admin
    .from("menu_items")
    .select("id, store_id")
    .eq("id", itemId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing || existing.store_id !== access.storeId) {
    throw new Error("Item not found for this store");
  }

  const { error } = await admin
    .from("menu_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;

  revalidatePath("/dashboard/menu");
}

// ── Option groups / modifiers ───────────────────────────────────────

type OptionRow = {
  label: string;
  price_delta: number | null;
  is_available: boolean | null;
  sort_order: number;
};
type GroupRow = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  options: OptionRow[];
};

// Fetch a menu item's option groups (+ their options) for the editor,
// sorted by sort_order. Ownership-checked against the caller's store.
export async function getMenuItemOptions(itemId: string): Promise<GroupRow[]> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: item, error: itemErr } = await admin
    .from("menu_items")
    .select("id, store_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item || item.store_id !== access.storeId) throw new Error("Item not found for this store");

  const { data: groups, error } = await admin
    .from("menu_item_option_groups")
    .select("id, name, min_select, max_select, sort_order, options:menu_item_options(label, price_delta, is_available, sort_order)")
    .eq("menu_item_id", itemId)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (groups ?? []).map((g) => ({
    ...g,
    options: [...((g.options as OptionRow[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  })) as GroupRow[];
}

// Transactional full-replace of a menu item's option groups via the
// shared set_menu_item_options RPC. The service-role client carries no
// auth.uid(), so the RPC permits service_role — we verify store
// ownership here first (same guard as every other write in this file).
export async function setMenuItemOptions(itemId: string, groups: unknown): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: item, error: itemErr } = await admin
    .from("menu_items")
    .select("id, store_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item || item.store_id !== access.storeId) throw new Error("Item not found for this store");

  const { error } = await admin.rpc("set_menu_item_options", {
    p_menu_item_id: itemId,
    p_groups: groups ?? [],
  });
  if (error) throw error;

  revalidatePath("/dashboard/menu");
}
