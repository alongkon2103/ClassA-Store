export type ProductTab = 'info' | 'membership' | 'pricing' | 'variants' | 'content' | 'images' | 'features' | 'defaults' | 'functions' | 'presets' | 'gifts' | 'delivery' | 'revenue'
export type ProductSection = { key: string; label: string; tabs: { key: ProductTab; label: string }[] }

export function productSections({ editing, bundle, gameDefaults, th }: { editing: boolean; bundle: boolean; gameDefaults: boolean; th: boolean }): ProductSection[] {
  const label = (thai: string, en: string) => th ? thai : en
  return [
    { key: 'identity', label: label('ข้อมูลสินค้า', 'Product details'), tabs: [
      { key: 'info', label: label('ข้อมูลพื้นฐาน', 'Basics') },
      ...(bundle ? [{ key: 'membership' as const, label: label('เกมและสิทธิ์สมาชิก', 'Games & membership') }] : []),
    ] },
    { key: 'pricing', label: label('ราคาและแพ็กเกจ', 'Pricing'), tabs: [
      { key: 'pricing', label: label('ราคาหลักและส่วนลด', 'Base price & discounts') },
      ...(editing ? [{ key: 'variants' as const, label: label('แพ็กเกจที่ขาย', 'Packages for sale') }] : []),
    ] },
    { key: 'storefront', label: label('หน้าร้านและสื่อ', 'Storefront'), tabs: [
      { key: 'content', label: label('คำอธิบายและวิดีโอ', 'Descriptions & videos') },
      ...(editing ? [{ key: 'images' as const, label: label('รูปภาพ', 'Images') }, { key: 'features' as const, label: label('จุดเด่นสินค้า', 'Product highlights') }] : []),
    ] },
    ...(editing && !bundle ? [{ key: 'gameplay', label: label('การทำงานของเกม', 'Game setup'), tabs: [
      { key: (gameDefaults ? 'defaults' : 'functions') as ProductTab, label: label('คำสั่งและเหตุการณ์', 'Actions & events') },
      { key: 'presets' as const, label: label('พรีเซ็ต', 'Presets') },
      { key: 'gifts' as const, label: label('ของขวัญในเกม', 'In-game gifts') },
    ] }] : []),
    { key: 'delivery', label: label('การส่งมอบ', 'Delivery'), tabs: [{ key: 'delivery', label: label('สิทธิ์และการเชื่อมต่อ', 'Access & integrations') }] },
    ...(editing ? [{ key: 'revenue', label: label('รายได้', 'Revenue'), tabs: [{ key: 'revenue' as const, label: label('รูปแบบและการแบ่งรายได้', 'Revenue model & shares') }] }] : []),
  ]
}

export function resolveProductTab(value: string | undefined, sections: ProductSection[]): ProductTab {
  const alias = value === 'partnership' || value === 'consignment' ? 'revenue' : value
  return sections.flatMap(s => s.tabs).find(t => t.key === alias)?.key ?? 'info'
}

export function validateProductBasics(form: { name_en: string; name_th: string; slug: string; price: string | number; type: string; program_key: string; bundle_product_ids: string[]; bundle_all_ac_games?: boolean }): { tab: ProductTab; field: string } | null {
  for (const field of ['name_en', 'name_th', 'slug'] as const) if (!form[field].trim()) return { tab: 'info', field }
  if (!String(form.price).trim() || !Number.isFinite(Number(form.price)) || Number(form.price) <= 0) return { tab: 'pricing', field: 'price' }
  if (form.type === 'desktop_program' && !/^[a-z0-9_]{2,40}$/.test(form.program_key)) return { tab: 'delivery', field: 'program_key' }
  if (form.type === 'bundle' && !form.bundle_all_ac_games && (form.bundle_product_ids.length < 2 || form.bundle_product_ids.length > 50)) return { tab: 'membership', field: 'bundle_product_ids' }
  return null
}
