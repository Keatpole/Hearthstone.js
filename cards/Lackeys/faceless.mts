// Created by Hand (before the Card Creator Existed)

import { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
    name: "Faceless Lackey",
    stats: [1, 1],
    desc: "<b>Battlecry:</b> Summon a random 2-Cost minion.",
    cost: 1,
    type: "Minion",
    tribe: "None",
    classes: ["Neutral"],
    rarity: "Free",
    uncollectible: true,
    id: 25,

    battlecry(plr, game, self) {
        // Summon a random 2-Cost minion.

        // filter out all cards that aren't 2-cost minions
        let minions = game.functions.getCards().filter(card => card.type === "Minion" && card.cost === 2);

        // Choose a random minion
        let _rand = game.functions.randList(minions);
        if (!_rand) return;

        let rand = _rand.actual;

        // Summon the minion
        let minion = new game.Card(rand.name, plr);
        game.summonMinion(minion, plr);
    }
}
