// Created by Hand

import { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
    name: "10 Mana",
    text: "Gain 10 Mana.",
    cost: 0,
    type: "Spell",
    spellSchool: "None",
    classes: ["Neutral"],
    rarity: "Free",
    uncollectible: true,
    id: 65,

    cast(plr, self) {
        // Gain 10 Mana.
        plr.gainMana(10);
    },

    test(plr, self) {
        const assert = game.functions.assert;

        plr.mana = 5;
        self.activate("cast");

        assert(() => plr.mana === 10);
    }
}
