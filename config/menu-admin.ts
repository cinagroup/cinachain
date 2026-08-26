// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Menu Admin — key is the i18n dictionary key (sidebar.*)
// label is the English fallback when i18n is unavailable (SSR/prerender)
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export const menuAdmin = [
  {
    label: "Overview",
    key: "overview",
    href: "/admin",
  },
  {
    label: "Badges",
    key: "badges",
    href: "/admin/badges",
  },
  {
    label: "Whitelist",
    key: "whitelist",
    href: "/admin/whitelist",
  },
  {
    label: "Statistics",
    key: "statistics",
    href: "/admin/stats",
  },
  {
    label: "Contract",
    key: "contract",
    href: "/admin/contract",
  },
  {
    label: "Billing",
    key: "billing",
    href: "/admin/billing",
  },
]
