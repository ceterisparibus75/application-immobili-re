import { describe, expect, it } from "vitest";

import {
  getMobileNavGroups,
  getTopNavGroups,
  MOBILE_NAV_GROUPS,
  TOP_NAV_GROUPS,
} from "./navigation-config";

function itemsForGroup(groups: typeof TOP_NAV_GROUPS, title: string) {
  const group = groups.find((navGroup) => navGroup.title === title);
  if (!group) throw new Error(`Missing group ${title}`);
  return group.items;
}

describe("navigation-config", () => {
  it("expose les hubs Location et Finances en première entrée de topnav", () => {
    expect(itemsForGroup(TOP_NAV_GROUPS, "Location")[0]).toMatchObject({
      name: "Vue d'ensemble",
      href: "/location",
    });
    expect(itemsForGroup(TOP_NAV_GROUPS, "Finances")[0]).toMatchObject({
      name: "Vue d'ensemble",
      href: "/finances",
    });
  });

  it("garde les hubs dans la navigation mobile complète", () => {
    expect(itemsForGroup(MOBILE_NAV_GROUPS, "Location").map((item) => item.href)).toContain("/location");
    expect(itemsForGroup(MOBILE_NAV_GROUPS, "Finances").map((item) => item.href)).toContain("/finances");
  });

  it("expose les workflows dans la navigation desktop et mobile", () => {
    expect(itemsForGroup(TOP_NAV_GROUPS, "Automatisation")).toContainEqual(
      expect.objectContaining({ name: "Workflows", href: "/workflows" }),
    );
    expect(itemsForGroup(MOBILE_NAV_GROUPS, "Automatisation")).toContainEqual(
      expect.objectContaining({ name: "Workflows", href: "/workflows" }),
    );
  });

  it("masque les décomptes de gestion tiers quand aucun bail n'est sous gestion tiers", () => {
    const flags = { showThirdPartyManagement: false };

    expect(itemsForGroup(getTopNavGroups(flags), "Finances")).not.toContainEqual(
      expect.objectContaining({ href: "/releves-gestion" }),
    );
    expect(itemsForGroup(getMobileNavGroups(flags), "Finances")).not.toContainEqual(
      expect.objectContaining({ href: "/releves-gestion" }),
    );
  });

  it("affiche les décomptes de gestion tiers quand un bail est sous gestion tiers", () => {
    const flags = { showThirdPartyManagement: true };

    expect(itemsForGroup(getTopNavGroups(flags), "Finances")).toContainEqual(
      expect.objectContaining({
        name: "Décompte de gestion tiers",
        href: "/releves-gestion",
      }),
    );
  });
});
