// Shared client-side model for the menu item options editor + the
// payload shape the set_menu_item_options RPC expects. Lives in its own
// module (not actions.ts, which is "use server" and may only export
// async functions).

// Draft state held by the editor UI. Prices are kept as integer-cents
// strings to match the rest of the menu form's currency convention.
export type OptionDraft = {
  label: string;
  priceCents: string; // "" or integer cents; "" / 0 → free
  isAvailable: boolean;
};

export type GroupDraft = {
  name: string;
  selectType: "single" | "multi";
  required: boolean;
  maxSelect: string; // multi only; "" = up to all options
  options: OptionDraft[];
};

// What the RPC stores (numeric dollars, derived min/max).
export type GroupPayload = {
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  options: {
    label: string;
    price_delta: number;
    is_available: boolean;
    sort_order: number;
  }[];
};

export function emptyOption(): OptionDraft {
  return { label: "", priceCents: "", isAvailable: true };
}

export function emptyGroup(): GroupDraft {
  return { name: "", selectType: "single", required: false, maxSelect: "", options: [emptyOption()] };
}

// Drop blank rows, then map the friendly toggles onto min/max:
//   single → max 1
//   multi  → max = explicit cap (clamped to option count) or all options
//   required → min 1, else 0
export function groupsToPayload(groups: GroupDraft[]): GroupPayload[] {
  return groups
    .map((g, gi) => {
      const opts = g.options.filter((o) => o.label.trim().length > 0);
      if (!g.name.trim() || opts.length === 0) return null;
      const cap = Number(g.maxSelect);
      const maxSelect =
        g.selectType === "single"
          ? 1
          : g.maxSelect && cap > 0
            ? Math.min(cap, opts.length)
            : opts.length;
      const minSelect = g.required ? 1 : 0;
      return {
        name: g.name.trim(),
        min_select: minSelect,
        max_select: Math.max(maxSelect, minSelect),
        sort_order: gi,
        options: opts.map((o, oi) => ({
          label: o.label.trim(),
          price_delta: o.priceCents && Number(o.priceCents) > 0 ? Number(o.priceCents) / 100 : 0,
          is_available: o.isAvailable,
          sort_order: oi,
        })),
      } as GroupPayload;
    })
    .filter((g): g is GroupPayload => g !== null);
}

// Reverse: DB rows (as returned by getMenuItemOptions) → editor drafts.
type DbOption = { label: string; price_delta: number | null; is_available: boolean | null };
type DbGroup = { name: string; min_select: number; max_select: number; options: DbOption[] };

export function rowsToGroups(groups: DbGroup[]): GroupDraft[] {
  return groups.map((g) => {
    const optCount = g.options?.length ?? 0;
    const isSingle = g.max_select <= 1;
    return {
      name: g.name,
      selectType: isSingle ? "single" : "multi",
      required: g.min_select >= 1,
      // Only surface an explicit cap when it's a real limit (< all options).
      maxSelect: !isSingle && g.max_select < optCount ? String(g.max_select) : "",
      options: (g.options ?? []).map((o) => ({
        label: o.label,
        priceCents: o.price_delta ? String(Math.round(Number(o.price_delta) * 100)) : "",
        isAvailable: o.is_available ?? true,
      })),
    };
  });
}
