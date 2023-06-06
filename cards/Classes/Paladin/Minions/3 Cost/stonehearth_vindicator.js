// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Stonehearth Vindicator",
    stats: [3, 1],
    desc: "&BBattlecry: &RDraw a spell that costs (3) or less. It costs (0) this turn.",
    mana: 3,
    type: "Minion",
    tribe: "None",
    class: "Paladin",
    rarity: "Epic",
    set: "Fractured in Alterac Valley",
    id: 261,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    battlecry(plr, game, self) {
        let list = plr.deck.filter(c => c.type == "Spell" && c.mana <= 3);
        let spell = game.functions.randList(list, false);
        if (!spell) return;

        //let old_cost = spell.mana;
        //spell.mana = 0;
        spell.addEnchantment("mana = 0", self);

        plr.drawSpecific(spell);

        game.functions.addEventListener("EndTurn", () => {
            return true;
        }, () => {
            //spell.mana = old_cost;
            spell.removeEnchantment("mana = 0", self);
        }, 1);
    }
}
