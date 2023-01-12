module.exports = {
    name: "The Coin",
    desc: "Gain 1 Mana Crystal this turn only.",
    mana: 0,
    class: "Neutral",
    rarity: "Free",
    set: "Core",
    uncollectible: true,

    cast(plr, game) {
        plr.refreshMana(1, plr.maxMaxMana);
    }
}
