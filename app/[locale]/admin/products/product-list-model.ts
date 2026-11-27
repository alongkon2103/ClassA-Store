type ProductListItem = {
  id: string
  name_th: string | null
  name_en: string | null
  slug: string
  type: string
  is_active: boolean
  is_featured: boolean
  orders_new_count: number
  created_at: string | null
}

export type ProductFilters = {
  search: string
  status: "all" | "active" | "inactive" | "featured"
  type: string
  sort: "newest" | "oldest" | "name" | "orders"
  locale: string
}

export function productName(product: Pick<ProductListItem, "name_th" | "name_en">, locale: string) {
  return (locale === "th" ? product.name_th || product.name_en : product.name_en || product.name_th) || "—"
}

export function filterProducts<T extends ProductListItem>(products: T[], filters: ProductFilters): T[] {
  const query = filters.search.trim().toLocaleLowerCase()
  return products.filter(product => {
    if (filters.type !== "all" && product.type !== filters.type) return false
    if (filters.status === "active" && !product.is_active) return false
    if (filters.status === "inactive" && product.is_active) return false
    if (filters.status === "featured" && !product.is_featured) return false
    return [product.name_th, product.name_en, product.slug].some(value => (value || "").toLocaleLowerCase().includes(query))
  }).sort((a, b) => {
    if (filters.sort === "name") return productName(a, filters.locale).localeCompare(productName(b, filters.locale), filters.locale)
    if (filters.sort === "orders") return b.orders_new_count - a.orders_new_count
    const dateDifference = (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0)
    return filters.sort === "oldest" ? -dateDifference : dateDifference
  })
}

export function getListPage<T>(items: T[], requestedPage: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    start: items.length ? (page - 1) * pageSize + 1 : 0,
    end: Math.min(page * pageSize, items.length),
  }
}

export function getProductPricing(product: { price: number; product_variants: { price: number; variant_type: string | null }[] }) {
  const standard = product.product_variants.filter(variant => variant.variant_type !== "premium")
  const premium = product.product_variants.length - standard.length
  const prices = standard.map(variant => variant.price)
  if (!prices.length && !premium) prices.push(product.price)
  return {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    packages: standard.length,
    premium,
  }
}
