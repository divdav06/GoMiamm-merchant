"use client";

import { emptyGroup, emptyOption, type GroupDraft, type OptionDraft } from "./optionTypes";

// Controlled editor for a menu item's option groups (e.g. Spice level,
// Sides, Extras). Pure UI — the parent modal owns the draft state and
// persists via setMenuItemOptions on save.
export function OptionsEditor({
  groups,
  onChange,
  disabled,
}: {
  groups: GroupDraft[];
  onChange: (next: GroupDraft[]) => void;
  disabled?: boolean;
}) {
  function patchGroup(gi: number, patch: Partial<GroupDraft>) {
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function patchOption(gi: number, oi: number, patch: Partial<OptionDraft>) {
    onChange(
      groups.map((g, i) =>
        i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Options &amp; modifiers
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...groups, emptyGroup()])}
          className="text-xs font-semibold text-brand hover:text-brand-600 disabled:opacity-50"
        >
          + Add group
        </button>
      </div>

      {groups.length === 0 && (
        <p className="text-[11px] text-gray-400">
          No options. Add a group like “Spice level”, “Sides”, or “Size”.
        </p>
      )}

      {groups.map((g, gi) => (
        <div key={gi} className="rounded-xl border border-gray-200 p-3 space-y-3 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={g.name}
              disabled={disabled}
              onChange={(e) => patchGroup(gi, { name: e.target.value })}
              placeholder="Group name (e.g. Spice level)"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(groups.filter((_, i) => i !== gi))}
              className="text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-2 py-1 disabled:opacity-50"
            >
              Remove
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-700">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`seltype-${gi}`}
                checked={g.selectType === "single"}
                disabled={disabled}
                onChange={() => patchGroup(gi, { selectType: "single" })}
              />
              Single choice
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={`seltype-${gi}`}
                checked={g.selectType === "multi"}
                disabled={disabled}
                onChange={() => patchGroup(gi, { selectType: "multi" })}
              />
              Multiple choice
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={g.required}
                disabled={disabled}
                onChange={(e) => patchGroup(gi, { required: e.target.checked })}
              />
              Required
            </label>
            {g.selectType === "multi" && (
              <label className="inline-flex items-center gap-1.5">
                Max
                <input
                  type="number"
                  min={1}
                  value={g.maxSelect}
                  disabled={disabled}
                  onChange={(e) => patchGroup(gi, { maxSelect: e.target.value })}
                  placeholder="all"
                  className="w-16 px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            {g.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="text"
                  value={o.label}
                  disabled={disabled}
                  onChange={(e) => patchOption(gi, oi, { label: e.target.value })}
                  placeholder="Option (e.g. Extra cheese)"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={o.priceCents}
                    disabled={disabled}
                    onChange={(e) => patchOption(gi, oi, { priceCents: e.target.value })}
                    placeholder="0"
                    title="Extra cost in cents (150 = +$1.50)"
                    className="w-24 pl-6 pr-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+¢</span>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    patchGroup(gi, { options: g.options.filter((_, j) => j !== oi) })
                  }
                  aria-label="Remove option"
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50 px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => patchGroup(gi, { options: [...g.options, emptyOption()] })}
              className="text-xs font-semibold text-brand hover:text-brand-600 disabled:opacity-50"
            >
              + Add option
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
