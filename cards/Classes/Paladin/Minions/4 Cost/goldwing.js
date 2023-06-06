// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Goldwing",
    stats: [3, 5],
    desc: "&BRush. Battlecry: &RIf you're holding a Mech, gain &BWindfury&R.",
    mana: 4,
    type: "Minion",
    tribe: "Mech / Dragon",
    class: "Paladin",
    rarity: "Rare",
    set: "Return to Naxxramas",
    keywords: ["Rush"],
    id: 262,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    battlecry(plr, game, self) {
        let mechs = plr.hand.filter(c => c.type == "Minion" && game.functions.matchTribe(c.tribe, "Mech"));
        if (mechs.length <= 0) return; // If there are no mechs in your hand, cancel the battlecry.

        // You're holding a mech
        self.addKeyword("Windfury");
    }
}
