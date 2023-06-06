// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Educated Elekk",
    stats: [3, 4],
    desc: "Whenever a spell is played, this minion remembers it. Deathrattle: Shuffle the spells into your deck.",
    mana: 3,
    type: "Minion",
    tribe: "Beast",
    class: "Neutral",
    rarity: "Epic",
    set: "Scholomance Academy",
    id: 44,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    passive(plr, game, card, key, val) {
        if (key !== "PlayCard") return;
        if (val.type !== "Spell") return;
        
        card.storage.push(val);
    },

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    deathrattle(plr, game, card) {
        card.storage.forEach(c => plr.shuffleIntoDeck(new game.Card(c.name, plr)));

        card.storage = [];
    }
}
