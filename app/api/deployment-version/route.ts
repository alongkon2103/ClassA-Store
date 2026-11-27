export const dynamic = 'force-dynamic'
export function GET() {
  // Inlined by Next at build time, so this identifies the responding build.
  return Response.json({commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || 'development'}, {headers:{'Cache-Control':'no-store'}})
}
