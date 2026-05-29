import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { SupportChat, type SupportMessage } from "./SupportChat";

export default async function SupportPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());

  // RLS lets the user read their own thread + replies — no service
  // role needed for the initial load. We find their most recent root
  // in the restaurant inbox, then OR-fetch (root OR children of root).
  const { data: rootRow } = await supabase
    .from("support_tickets")
    .select("id, status")
    .eq("requester_user_id", access.userId)
    .eq("mailbox", "support")
    .eq("inbox", "restaurant")
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: SupportMessage[] = [];
  if (rootRow) {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, body, created_at, from_admin, agent, parent_id")
      .or(`id.eq.${rootRow.id},parent_id.eq.${rootRow.id}`)
      .order("created_at", { ascending: true });
    messages = (data ?? []) as SupportMessage[];
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Support</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · chat with our team. ARIA replies first, a human takes over when needed.
        </p>
      </header>

      <SupportChat
        userId={access.userId}
        initialRootId={rootRow?.id ?? null}
        initialStatus={rootRow?.status ?? null}
        initialMessages={messages}
      />
    </div>
  );
}
