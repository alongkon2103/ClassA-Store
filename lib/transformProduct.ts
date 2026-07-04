export function transformProduct<T extends { price: unknown }>(p: T) {
  return {
    ...p,
    price: Number(p.price),
  }
}