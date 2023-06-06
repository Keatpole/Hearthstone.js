// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Golden Monkey",
    stats: [6, 6],
    desc: "Taunt. Battlecry: Replace your hand and deck with Legendary minions.",
    mana: 4,
    type: "Minion",
    tribe: "None",
    class: "Neutral",
    rarity: "Free",
    set: "Core",
    keywords: ["Taunt"],
    uncollectible: true,
    id: 49,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    battlecry(plr, game, card) {
        let new_hand = [];
        let new_deck = [];

        let possible_cards = game.functions.getCards().filter(c => c.rarity == "Legendary" && c.type == "Minion");

        plr.hand.forEach(c => {
            let card = game.functions.randList(possible_cards);
            new_hand.push(new game.Card(card.name, plr));
        });

        plr.deck.forEach(c => {
            let card = game.functions.randList(possible_cards);
            new_deck.push(new game.Card(card.name, plr));
        });

        plr.hand = new_hand;
        plr.deck = new_deck;
    }
}
