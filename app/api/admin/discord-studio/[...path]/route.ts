import { validateAdmin } from "@/lib/adminAuth";
import { proxyDiscordStudio } from "@/lib/discordStudioProxy";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const admin = await validateAdmin(["admin"]);
  if (!admin.isValid || !admin.session?.user?.id) {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return Response.json(
        {
          error: "Website session expired. Sign in again to keep editing.",
          code: "SESSION_EXPIRED",
        },
        { status: 401 },
      );
    return (
      admin.response || Response.json({ error: "Forbidden" }, { status: 403 })
    );
  }
  const { path } = await context.params;
  return proxyDiscordStudio(request, path, {
    userId: admin.session.user.id,
    secret: process.env.DISCORD_STUDIO_BRIDGE_SECRET,
  });
}
export {
  handle as GET,
  handle as HEAD,
  handle as POST,
  handle as PUT,
  handle as DELETE,
};
