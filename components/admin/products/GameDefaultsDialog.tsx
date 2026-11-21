"use client"

import { useEffect, useRef, type ReactNode } from "react"

/** Native modality keeps background controls inert and returns focus to the opener. */
export default function GameDefaultsDialog({ label, error, children, returnFocus }: { label: string; error?: string; children: ReactNode; returnFocus: HTMLElement | null }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const alert = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (error) { alert.current?.focus({ preventScroll: true }); dialog.current?.scrollTo({ top: 0 }) } }, [error])
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const opener = returnFocus
    const overflow = window.document.body.style.overflow
    const sync = () => {
      const parent = element.parentElement
      const visible = !!parent?.getClientRects().length && !parent.closest("[hidden]") && getComputedStyle(parent).visibility !== "hidden"
      if (visible && !element.open) { element.showModal(); window.document.body.style.overflow = "hidden" }
      else if (!visible && element.open) { element.close(); window.document.body.style.overflow = overflow }
    }
    sync()
    const observer = new MutationObserver(sync)
    for (let parent = element.parentElement; parent; parent = parent.parentElement) observer.observe(parent, { attributes: true, attributeFilter: ["hidden", "class", "style"] })
    return () => { observer.disconnect(); element.close(); window.document.body.style.overflow = overflow; queueMicrotask(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }) }
  }, [returnFocus])
  const requestClose = () => [...(dialog.current?.querySelectorAll<HTMLButtonElement>("[data-editor-close]") || [])].at(-1)?.click()
  return <dialog ref={dialog} aria-label={label} aria-modal="true" data-testid="defaults-dialog" onKeyDown={event => {
    if (event.key !== "Tab") return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]')].filter(node => node.tabIndex >= 0 && !node.hasAttribute("disabled") && node.getClientRects().length)
    const active = window.document.activeElement, first = controls[0], last = controls.at(-1)
    if (event.shiftKey && active === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus() }
  }} onCancel={event => { event.preventDefault(); requestClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose()
  }} className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[720px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-accent/20 bg-bg-card p-0 text-text-base shadow-2xl backdrop:bg-black/65">
    {error && <p ref={alert} tabIndex={-1} role="alert" className="mx-5 mt-4 rounded-lg border border-red-400/25 bg-red-500/5 p-3 text-[13px] text-red-400">{error}</p>}
    {children}
  </dialog>
}
