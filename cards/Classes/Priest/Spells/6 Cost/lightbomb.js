// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Lightbomb",
    desc: "Deal damage to each minion equal to its Attack.",
    mana: 6,
    type: "Spell",
    class: "Priest",
    rarity: "Epic",
    set: "Goblins vs Gnomes",
    spellClass: "Holy",
    id: 223,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    cast(plr, game, self) {
        game.board.forEach(p => {
            p.forEach(m => {
                game.attack(m.getAttack(), m);
            });
        });
    }
}
