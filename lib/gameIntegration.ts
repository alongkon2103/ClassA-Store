import { AC_MAGNET_PRODUCT_ID, GameDefaultsError, defaultsRecord, isGameCommandInput, type GameCommandInput } from "./tikkiesGameDefaults"

export type GameIntegration = { schemaVersion: 1; mode: "keyboard" | "api"; protocol: null | "roblox-interactive-v1"; placeIds: string[]; universeId: string | null }
export const GAME_COMMAND_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/
const numericId = /^[1-9]\d{0,19}$/
export function validateGameIntegration(value: unknown): GameIntegration {
  const invalid = (): never => { throw new GameDefaultsError("invalid_integration") }
  if (!defaultsRecord(value) || Object.keys(value).some(key => !["schemaVersion", "mode", "protocol", "placeIds", "universeId"].includes(key)) || value.schemaVersion !== 1 || !["keyboard", "api"].includes(value.mode as string) || !Array.isArray(value.placeIds) || value.placeIds.length > 50 || value.placeIds.some(id => typeof id !== "string" || !numericId.test(id)) || new Set(value.placeIds).size !== value.placeIds.length || value.universeId !== null && (typeof value.universeId !== "string" || !numericId.test(value.universeId))) return invalid()
  if (value.mode === "keyboard" ? value.protocol !== null || value.placeIds.length !== 0 || value.universeId !== null : value.protocol !== "roblox-interactive-v1" || value.placeIds.length === 0) return invalid()
  return { schemaVersion: 1, mode: value.mode as GameIntegration["mode"], protocol: value.protocol as GameIntegration["protocol"], placeIds: [...value.placeIds] as string[], universeId: value.universeId as string | null }
}
export function defaultGameIntegration(productId: string): GameIntegration {
  return productId.toLowerCase() === AC_MAGNET_PRODUCT_ID
    ? { schemaVersion: 1, mode: "api", protocol: "roblox-interactive-v1", placeIds: ["113965026399564"], universeId: "10775380860" }
    : { schemaVersion: 1, mode: "keyboard", protocol: null, placeIds: [], universeId: null }
}
export function publishedGameCommands(document: { effects: { responses: Record<string, unknown>[] }[] }): string[] {
  return [...new Set(document.effects.flatMap(effect => effect.responses.filter(response => response.type === "robloxEvent" && typeof response.event === "string" && GAME_COMMAND_IDENTIFIER.test(response.event)).map(response => response.event as string)))]
}
// The canonical validator has already checked every occurrence of each command.
export function publishedGameCommandInputs(document: { effects: { responses: Record<string, unknown>[] }[] }): Record<string, GameCommandInput> {
  return Object.fromEntries(document.effects.flatMap(effect => effect.responses.filter(response => response.type === "robloxEvent" && typeof response.event === "string" && GAME_COMMAND_IDENTIFIER.test(response.event) && isGameCommandInput(response.input)).map(response => [response.event as string, response.input as GameCommandInput])))
}
export function validateGameIntegrationResponses(integration: Pick<GameIntegration, "mode">, document: { platform: string; effects: { responses: Record<string, unknown>[] }[] }): void {
  if (document.platform !== "roblox") return
  if (integration.mode === "api" && publishedGameCommands(document).length > 200) throw new GameDefaultsError("game_commands_capacity_exceeded", 400)
  const forbidden = integration.mode === "api" ? "keypress" : "robloxEvent"
  if (document.effects.some(effect => effect.responses.some(response => response.type === forbidden))) throw new GameDefaultsError("integration_response_mismatch", 409)
}
