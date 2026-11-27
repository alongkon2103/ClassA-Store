import { setRequestLocale } from "next-intl/server";
import { requireAdminPage } from "@/lib/adminAuth";
import { Megaphone } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function DiscordStudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireAdminPage(["admin"]);
  const { locale } = await params;
  setRequestLocale(locale);
  const th = locale === "th";
  return (
    <section className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-base">
          <Megaphone size={24} className="text-accent-light" />
          {th ? "ประกาศ Discord" : "Discord announcements"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {th
            ? "เขียนข้อความและรูปแยกตามภาษา สมาชิกเลือกอ่านคำแปลได้เป็นส่วนตัว"
            : "Write text and images for each language. Members choose a private translation."}
        </p>
      </header>
      <iframe
        src="/api/admin/discord-studio/ui/index.html"
        title="Discord Message Studio"
        className="block min-h-[850px] w-full border-0 bg-bg-base"
        style={{ height: "calc(100vh - 170px)" }}
      />
    </section>
  );
}
