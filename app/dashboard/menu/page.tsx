import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { MenuList, type MenuItem } from "./MenuList";

export default async function MenuPage() {
  const access = await checkPartnerAccess();
  if (!access) return null; // layout already redirected

  const supabase = createServerSupabase(cookies());
  const { data: items } = await supabase
    .from("menu_items")
    .select("id, store_id, name, description, price, category, image_url, is_available")
    .eq("store_id", access.storeId)
    .order("category", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · changes go live instantly for customers.
        </p>
      </header>

      <MenuList storeId={access.storeId} initialItems={(items ?? []) as MenuItem[]} />
    </div>
  );
}
