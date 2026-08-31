import { describe, expect, it, vi } from "vitest"

import {
  CINAAUTH_POPUP_NAME_PREFIX,
  createCinaauthPopupMessage,
  isCinaauthPopupContext,
  isCinaauthPopupMessage,
  isCinaauthPopupWindow,
  launchCinaauthPopup,
} from "../auth/cinaauth-popup"

describe("CinaAuth popup protocol", () => {
  const attemptId = "123e4567-e89b-42d3-a456-426614174000"

  it("creates a token-free success message", () => {
    expect(createCinaauthPopupMessage("success", attemptId)).toEqual({
      source: "cinachain-cinaauth",
      status: "success",
      attemptId,
    })
  })

  it("creates an error message for the parent page", () => {
    expect(
      createCinaauthPopupMessage("error", attemptId, "Access denied")
    ).toEqual({
      source: "cinachain-cinaauth",
      status: "error",
      attemptId,
      message: "Access denied",
    })
  })

  it("accepts only messages from the CinaAuth popup protocol", () => {
    expect(
      isCinaauthPopupMessage(createCinaauthPopupMessage("success", attemptId))
    ).toBe(true)
    expect(
      isCinaauthPopupMessage(
        createCinaauthPopupMessage("error", attemptId, "Access denied")
      )
    ).toBe(true)
    expect(isCinaauthPopupMessage({ source: "other", status: "success" })).toBe(
      false
    )
    expect(
      isCinaauthPopupMessage({
        source: "cinachain-cinaauth",
        status: "error",
        attemptId,
      })
    ).toBe(false)
    expect(
      isCinaauthPopupMessage({
        source: "cinachain-cinaauth",
        status: "success",
        attemptId: "not-a-uuid",
      })
    ).toBe(false)
  })

  it("recognizes popup windows by their isolated name", () => {
    expect(
      isCinaauthPopupWindow(`${CINAAUTH_POPUP_NAME_PREFIX}attempt-id`)
    ).toBe(true)
    expect(isCinaauthPopupWindow("cinachain-main-window")).toBe(false)
  })

  it("requires a valid per-attempt session marker", () => {
    expect(isCinaauthPopupContext(attemptId)).toBe(true)
    expect(isCinaauthPopupContext("1")).toBe(false)
    expect(isCinaauthPopupContext(null)).toBe(false)
  })

  it("configures and returns an available popup", async () => {
    const popup = {
      closed: false,
      close: vi.fn(),
    } as unknown as Window
    const configurePopup = vi.fn(() => Promise.resolve())

    await expect(
      launchCinaauthPopup({
        attemptId,
        openPopup: () => popup,
        configurePopup,
      })
    ).resolves.toEqual({ mode: "popup", popup, attemptId })
    expect(configurePopup).toHaveBeenCalledWith(popup)
  })

  it("stays on the current page when the browser blocks the popup", async () => {
    const configurePopup = vi.fn(() => Promise.resolve())

    await expect(
      launchCinaauthPopup({
        attemptId,
        openPopup: () => null,
        configurePopup,
      })
    ).rejects.toThrow("Allow pop-ups for this site")
    expect(configurePopup).not.toHaveBeenCalled()
  })

  it("closes a popup when authorization setup fails", async () => {
    const close = vi.fn()
    const popup = { closed: false, close } as unknown as Window
    const failure = new Error("Discovery failed")

    await expect(
      launchCinaauthPopup({
        attemptId,
        openPopup: () => popup,
        configurePopup: () => Promise.reject(failure),
      })
    ).rejects.toBe(failure)
    expect(close).toHaveBeenCalledOnce()
  })
})
