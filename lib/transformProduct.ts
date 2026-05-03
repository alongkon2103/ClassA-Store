export function transformProduct(p: any) {
  return {
    ...p,
    price: Number(p.price),
  }
}