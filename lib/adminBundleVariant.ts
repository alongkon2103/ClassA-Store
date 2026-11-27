/** Admin input validation for the duration package applied to every bundle member. */
export function validateAdminBundleVariant(value: {
  variant_type?: unknown; premium_addon_price?: unknown; price?: unknown
  duration_type?: unknown; duration_days?: unknown
}) {
  if (value.variant_type != null && value.variant_type !== "normal") throw new Error("Bundles only support normal duration packages")
  if (value.premium_addon_price != null && Number(value.premium_addon_price) !== 0) throw new Error("Bundles do not support premium add-ons")
  if (!Number.isFinite(Number(value.price)) || Number(value.price) <= 0) throw new Error("Bundle package price must be greater than zero")
  const duration = value.duration_type === undefined ? "permanent" : value.duration_type
  if (!["permanent", "days"].includes(String(duration))) throw new Error("Choose a permanent or timed bundle package")
  if (duration === "days" && (!Number.isInteger(Number(value.duration_days)) || Number(value.duration_days) < 1 || Number(value.duration_days) > 2147483647 || Date.now() + Number(value.duration_days) * 86400000 >= new Date("9999-12-31T00:00:00Z").getTime())) {
    throw new Error("Bundle package duration must be a valid positive whole number of days")
  }
}
