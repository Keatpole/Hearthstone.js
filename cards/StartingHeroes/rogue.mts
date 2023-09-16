// Created by the Custom Card Creator

import { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
    name: "Rogue Starting Hero",
    displayName: "Valeera Sanguinar",
    desc: "Rogue starting hero",
    mana: 0,
    type: "Hero",
    classes: ["Rogue"],
    rarity: "Free",
    hpDesc: "Equip a 1/2 Dagger.",
    hpCost: 2,
    uncollectible: true,
    id: 12,

    heropower(plr, game, self) {
        // Equip a 1/2 Dagger.

        // Create the weapon card
        const wpn = new game.Card("Wicked Knife", plr);

        // Equip the weapon
        plr.setWeapon(wpn);
    }
}
