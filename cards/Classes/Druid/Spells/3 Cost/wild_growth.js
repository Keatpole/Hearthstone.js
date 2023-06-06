// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Wild Growth",
    desc: "Gain an empty Mana Crystal.",
    mana: 3,
    type: "Spell",
    class: "Druid",
    rarity: "Common",
    set: "Core",
    spellClass: "Nature",
    id: 21,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    cast(plr, game, card) {
        plr.gainEmptyMana(1);
    }
}
