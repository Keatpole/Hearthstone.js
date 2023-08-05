// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Palm Reading",
    desc: "Discover a spell. Reduce the Cost of spells in your hand by (1).",
    mana: 3,
    type: "Spell",
    class: "Priest",
    rarity: "Rare",
    set: "Madness at the Darkmoon Faire",
    spellClass: "Shadow",
    id: 179,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    cast(plr, game, self) {
        // Discover a spell
        let list = game.functions.getCards().filter(c => c.type == "Spell" && [plr.heroClass, "Neutral"].includes(c.class));
        if (list.length == 0) return;
        
        let spell = game.interact.discover("Discover a spell.", list);
        if (!spell) return -1;

        plr.addToHand(spell);

        // Reduce the Cost of spells in your hand by (1)
        plr.hand.filter(c => c.type == "Spell").forEach(s => {
            //s.mana--;
            s.addEnchantment("-1 mana", self);
        });
    }
}
