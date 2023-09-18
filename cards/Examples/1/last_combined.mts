// Created by Hand

import { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
    name: "Combined Example 1",
    stats: [4, 4],
    desc: "<b>Taunt, Divine Shield. Battlecry: Dredge.</b> Gain +1/+1. (This example card combines everything you've learned in stage 1 into this card.)",
    cost: 1,
    type: "Minion",
    tribe: "All",
    classes: ["Priest", "Paladin"],
    rarity: "Legendary",
    keywords: ["Taunt", "Divine Shield"],
    uncollectible: true,
    id: 35,

    battlecry(plr, game, self) {
        // Dredge. Gain +1/+1.

        // Ordering is important. In the description it says that it dredges first, then adds +1/+1.
        game.interact.dredge();

        self.addStats(1, 1);
    }
}
