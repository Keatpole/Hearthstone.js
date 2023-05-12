module.exports = {
    name: "Combined Example 4",
    desc: "Quest: Play 3 cards. Reward: Reduce the cost of the next 10 Minions you play by 1.",
    mana: 1,
    type: "Spell",
    class: "Neutral",
    rarity: "Legendary",
    uncollectible: true,

    cast(plr, game, self) {
        game.functions.addQuest("Quest", plr, self, "PlayCard", 3, (val, turn, done) => {
            if (val == self) return false;
            if (!done) return;

            // The quest is done.
            // Add the `-1 mana` enchantment constantly
            let destroy = game.functions.addEventListener("", true, () => {
                plr.hand.filter(c => c.type == "Minion").forEach(m => {
                    if (m.enchantmentExists("-1 mana", self)) return;

                    m.addEnchantment("-1 mana", self);
                });
            }, -1);

            // Add an event listener to check if you've played 10 cards
            let amount = 0;

            game.functions.addEventListener("PlayCard", () => {
                return game.player == plr;
            }, () => {
                // Every time you play a card, increment `amount` by 1.
                amount++;

                if (amount < 10) return;

                destroy(); // Destroy the other event listener

                // Reverse the enchantent
                plr.hand.filter(c => c.type == "Minion").forEach(m => {
                    m.removeEnchantment("-1 mana", self);
                });

                // Destroy this event listener
                return true;
            }, -1);

            // Update the events to trigger the first event listener. This does nothing otherwise.
            game.events.broadcast("Update", self, plr);
        });
    }
}
