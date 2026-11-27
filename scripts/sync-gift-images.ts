// Compatibility entry point. Name-only upserts cannot represent TikTok's
// repeated gift names and could attach customer bindings to the wrong ID.
// This command now runs the canonical ID-based audit (READ ONLY by default).
// Use --execute only after the root operator has backed up and reviewed it.
console.warn('Legacy name-only gift image import retired; using canonical ID sync. Default is --dry-run; canonical image URLs are retained without downloading files.')
import('./sync-tikkies-gifts')
