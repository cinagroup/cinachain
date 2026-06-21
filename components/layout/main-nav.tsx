"use client"

import React from "react"
import Link from "next/link"
import {
  integrationCategories,
  cinaIntegrations,
} from "@/data/cina-integrations"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Separator } from "@/components/ui/separator"
import { LightDarkImage } from "@/components/shared/light-dark-image"

import { LinkComponent } from "../shared/link-component"

export function MainNav() {
  return (
    <nav className="hidden md:flex items-center gap-1">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="h-8 text-sm font-medium text-foreground/70 hover:text-foreground">
              Integrations
            </NavigationMenuTrigger>
            <NavigationMenuContent className="max-h-[768px] overflow-y-scroll rounded-lg border border-border bg-card shadow-vercel-modal p-4">
              <ul className="grid w-[400px] gap-3 md:w-[500px] md:grid-cols-2 lg:w-[768px] lg:grid-cols-3">
                {integrationCategories.map((category) => (
                  <React.Fragment key={category}>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground md:col-span-2 lg:col-span-3">
                      {category}
                    </h4>
                    <Separator className="md:col-span-2 lg:col-span-3" />
                    {Object.values(cinaIntegrations)
                      .filter((integration) => integration.category === category)
                      .map(({ name, href, description, imgDark, imgLight }) => (
                        <NavMenuListItem
                          key={name}
                          name={name}
                          href={href}
                          description={description}
                          lightImage={imgDark}
                          darkImage={imgLight}
                        />
                      ))}
                  </React.Fragment>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <LinkComponent href="https://docs.cinachain.com">
              <NavigationMenuLink className="h-8 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors">
                <span>Documentation</span>
              </NavigationMenuLink>
            </LinkComponent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}

interface NavMenuListItemProps {
  name: string
  description: string
  href: string
  lightImage: string
  darkImage: string
}

const NavMenuListItem = ({
  name,
  description,
  href,
  lightImage,
  darkImage,
}: NavMenuListItemProps) => {
  return (
    <li className="w-full min-w-full" key={name}>
      <NavigationMenuLink asChild>
        <a
          href={href}
          className="block select-none rounded-md p-3 no-underline outline-none transition-colors hover:bg-secondary"
        >
          <div className="flex items-center gap-x-2">
            <LightDarkImage
              LightImage={lightImage}
              DarkImage={darkImage}
              alt="icon"
              height={24}
              width={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-medium">{name}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
}
