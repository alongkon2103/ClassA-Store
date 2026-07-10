// Shared LiveGen tile/layout validation used by both order-scoped and
// public-draft save routes. Anything outside the clamp ranges below is treated
// as untrusted input — sanitized to a safe default rather than rejected.

type RawTile = {
  function_id?: unknown
  gift_id?: unknown
  gifts?: unknown
  label?: unknown
  side?: unknown
  order?: unknown
  gift_scale?: unknown
  gift_position?: unknown
  gift_x?: unknown
  gift_y?: unknown
  label_size?: unknown
  label_color?: unknown
  label_x?: unknown
  label_y?: unknown
  label_font?: unknown
  label_stroke_color?: unknown
  label_stroke_width?: unknown
  character_image?: unknown
  character_scale?: unknown
  character_y?: unknown
  name?: unknown
  source_function_id?: unknown
}

const clamp = (n: unknown, lo: number, hi: number, def: number) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return def
  return Math.min(hi, Math.max(lo, v))
}

// Hard cap on gift images per tile — anything beyond this is silently dropped
// so a hand-crafted API call can't bloat the stored JSON.
export const MAX_GIFTS_PER_TILE = 3

// Multi-gift support: each tile can show up to MAX_GIFTS_PER_TILE gift images,
// each with its own position/scale. Configs saved before this feature carry a
// single gift in the legacy flat fields (gift_id/gift_scale/gift_x/gift_y) —
// those are folded into a 1-item array here so old saves keep working.
function sanitizeTileGifts(t: RawTile): Array<{ gift_id: number; scale: number; x: number; y: number }> {
  if (Array.isArray(t.gifts)) {
    return (t.gifts as unknown[])
      .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
      .map((g) => ({
        gift_id: Number(g.gift_id),
        scale: clamp(g.scale, 0.1, 0.8, 0.32),
        x: clamp(g.x, 0, 1, 0.03),
        y: clamp(g.y, 0, 1, 0.03),
      }))
      .filter((g) => Number.isFinite(g.gift_id))
      .slice(0, MAX_GIFTS_PER_TILE)
  }
  const legacyId = t.gift_id == null ? NaN : Number(t.gift_id)
  if (!Number.isFinite(legacyId)) return []
  return [
    {
      gift_id: legacyId,
      scale: clamp(t.gift_scale, 0.1, 0.8, 0.32),
      x: clamp(t.gift_x, 0, 1, 0.03),
      y: clamp(t.gift_y, 0, 1, 0.03),
    },
  ]
}

export function sanitizeTiles(incoming: unknown, validFunctionIds: Set<string>) {
  const list = Array.isArray(incoming) ? (incoming as RawTile[]) : []
  return list
    .filter((t) => {
      if (!t || typeof t.function_id !== "string") return false
      // Custom tiles are validated by their id prefix; real ones must exist
      // in product_functions for this product.
      if (t.function_id.startsWith("custom_")) {
        return (
          typeof t.source_function_id === "string" &&
          validFunctionIds.has(t.source_function_id)
        )
      }
      return validFunctionIds.has(t.function_id)
    })
    .map((t) => {
      const isCustom = (t.function_id as string).startsWith("custom_")
      const tileGifts = sanitizeTileGifts(t)
      return {
        function_id: t.function_id as string,
        gifts: tileGifts,
        // Legacy mirror of the first gift so a rollback to the single-gift
        // client still renders something sensible.
        gift_id: tileGifts[0]?.gift_id ?? null,
        label: typeof t.label === "string" ? t.label.slice(0, 64) : "",
        side: t.side === "right" ? "right" : "left",
        order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0,
        gift_scale: tileGifts[0]?.scale ?? 0.32,
        gift_position: ["tl", "tr", "bl", "br"].includes(t.gift_position as string)
          ? (t.gift_position as string)
          : "tl",
        gift_x: tileGifts[0]?.x ?? 0.03,
        gift_y: tileGifts[0]?.y ?? 0.03,
        label_size: clamp(t.label_size, 12, 96, 36),
        label_color:
          typeof t.label_color === "string" ? t.label_color.slice(0, 24) : "auto",
        label_x: clamp(t.label_x, 0, 1, 0.96),
        label_y: clamp(t.label_y, 0, 1, 0.94),
        label_font:
          typeof t.label_font === "string" ? t.label_font.slice(0, 48) : "default",
        label_stroke_color:
          typeof t.label_stroke_color === "string"
            ? t.label_stroke_color.slice(0, 24)
            : "#000000",
        label_stroke_width: clamp(t.label_stroke_width, 0, 0.4, 0.08),
        ...(isCustom && {
          name: typeof t.name === "string" ? t.name.slice(0, 64) : "Custom",
          source_function_id: t.source_function_id as string,
        }),
        character_image:
          typeof t.character_image === "string" && t.character_image.length > 0
            ? t.character_image.slice(0, 500)
            : null,
        character_scale: clamp(t.character_scale, 0.3, 2, 1),
        character_y: clamp(t.character_y, -200, 200, 0),
      }
    })
}

export function sanitizeHiddenFunctionIds(
  incoming: unknown,
  validFunctionIds: Set<string>,
): string[] {
  if (!Array.isArray(incoming)) return []
  const out: string[] = []
  for (const v of incoming) {
    if (typeof v === "string" && validFunctionIds.has(v)) out.push(v)
  }
  return out
}

export function sanitizeLayout(incoming: unknown) {
  const l = (incoming ?? {}) as Record<string, unknown>
  return {
    column_gap: clamp(l.column_gap, 0, 400, 16),
    row_gap: clamp(l.row_gap, 0, 200, 16),
    padding: clamp(l.padding, 0, 200, 24),
    left_y_offset: clamp(l.left_y_offset, -400, 400, 0),
    right_y_offset: clamp(l.right_y_offset, -400, 400, 0),
    tile_width: clamp(l.tile_width, 120, 600, 280),
    tile_aspect: clamp(l.tile_aspect, 0.5, 2.5, 9 / 7),
    bg_color:
      typeof l.bg_color === "string" ? l.bg_color.slice(0, 24) : "transparent",
  }
}
