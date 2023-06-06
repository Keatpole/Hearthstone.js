// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "The Lich King's Obliterate",
    displayName: "Obliterate",
    desc: "Destroy a minion. Your hero takes damage equal to its Health.",
    mana: 2,
    type: "Spell",
    class: "Death Knight",
    rarity: "Free",
    set: "Knights of the Frozen Throne",
    uncollectible: true,
    id: 130,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    cast(plr, game, self) {
        let minion = game.interact.selectTarget("Destroy a minion. Your hero takes damage equal to its Health.", true, null, "minion");
        if (!minion) return -1;

        game.attack(minion.getHealth(), plr);
        minion.kill();
    }
}
