// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Menu Dashboard — key is the i18n dictionary key (sidebar.*)
// label is the English fallback when i18n is unavailable (SSR/prerender)
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export const menuDashboard = [
  {
    label: "Overview",
    key: "overview",
    href: "/dashboard",
  },
  {
    label: "My NFTs",
    key: "myNfts",
    href: "/dashboard/nfts",
  },
  {
    label: "Badges",
    key: "badges",
    href: "/dashboard/badges",
  },
  {
    label: "Favorites",
    key: "favorites",
    href: "/dashboard/favorites",
  },
  {
    label: "Account",
    key: "account",
    href: "/dashboard/account",
  },
  {
    label: "Credits",
    key: "credits",
    href: "/dashboard/credits",
  },
  {
    label: "Key ingress",
    key: "keyIngress",
    href: "/dashboard/keys",
  },
]
