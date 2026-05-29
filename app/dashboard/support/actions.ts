"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

// Mirrors driver-app/app/support.tsx's send() — find-or-create a root
// ticket for the current user in mailbox='support' inbox='restaurant',
// then either seed it (root) or append a child (parent_id=root.id).
// ARIA (the trigger on support_tickets INSERT) auto-replies; admin
// replies arrive as additional children with from_admin=true and
// surface to the chat through the Realtime subscription on the client.

const MAX_BODY_LEN = 2000;

async function requireAuthed() {
  const access = await checkPartnerAccess();
  if (!access) throw new Error("Unauthorized");
  return access;
}

export type SendMessageResult = {
  rootId: string;
  messageId: string;
  created_root: boolean;
};

export async function sendMessage(body: string): Promise<SendMessageResult> {
  const access = await requireAuthed();
  const text = body.trim();
  if (!text) throw new Error("Message body required");
  if (text.length > MAX_BODY_LEN) throw new Error(`Message must be ≤ ${MAX_BODY_LEN} characters`);

  const admin = createAdminSupabase();

  // Resolve the requester's display name from profiles so admin
  // messagerie shows something more human than the email local-part.
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", access.userId)
    .maybeSingle();
  const requesterName = profile?.full_name ?? null;

  // Find the user's most recent support root. Reuse it for follow-up
  // messages; only seed a new root when none exists yet.
  const { data: existingRoot } = await admin
    .from("support_tickets")
    .select("id")
    .eq("requester_user_id", access.userId)
    .eq("mailbox", "support")
    .eq("inbox", "restaurant")
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingRoot) {
    const { data: rootRow, error } = await admin
      .from("support_tickets")
      .insert({
        mailbox: "support",
        inbox: "restaurant",
        requester_user_id: access.userId,
        requester_email: access.email,
        requester_name: requesterName,
        subject: `Support · ${access.storeName}`,
        body: text,
        status: "open",
        from_admin: false,
        agent: "user",
        metadata: { store_id: access.storeId, store_name: access.storeName },
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/support");
    return { rootId: rootRow.id, messageId: rootRow.id, created_root: true };
  }

  const { data: childRow, error } = await admin
    .from("support_tickets")
    .insert({
      mailbox: "support",
      inbox: "restaurant",
      parent_id: existingRoot.id,
      requester_user_id: access.userId,
      requester_email: access.email,
      requester_name: requesterName,
      subject: `Support · ${access.storeName}`,
      body: text,
      from_admin: false,
      agent: "user",
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/dashboard/support");
  return { rootId: existingRoot.id, messageId: childRow.id, created_root: false };
}
