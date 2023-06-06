// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Biology Project",
    desc: "Each player gains 2 Mana Crystals.",
    mana: 1,
    type: "Spell",
    class: "Druid",
    rarity: "Common",
    set: "The Boomsday Project",
    spellClass: "Nature",
    id: 16,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    cast(plr, game, card) {
        plr.gainMana(2, true);
        game.opponent.gainMana(2, true);
    }
}
