// Created by the Custom Card Creator

/**
 * @type {import("../../../../../src/types").Blueprint}
 */
module.exports = {
    name: "Masters Call",
    displayName: "Master's Call",
    desc: "&BDiscover&R a minion in your deck. If all 3 are Beasts, draw them all.",
    mana: 3,
    type: "Spell",
    class: "Hunter",
    rarity: "Epic",
    set: "Rastakhan's Rumble",
    id: 229,

    /**
     * @type {import("../../../../../src/types").KeywordMethod}
     */
    cast(plr, game, self) {
        let list = plr.deck.filter(c => c.type == "Minion");
        
        let cards = game.functions.chooseItemsFromList(list, 3, false);
        let non_beasts = cards.filter(c => !game.functions.matchTribe(c.tribe, "Beast"));

        if (non_beasts.length <= 0) {
            // All three are beasts.
            cards.forEach(c => {
                plr.drawSpecific(c);
            });

            return;
        }

        // Not all three are beasts.
        let minion = game.interact.discover("Discover a minion in your deck.", cards, false);
        plr.addToHand(minion);
    }
}
