module.exports = {
    name: "Inspire Test",
    stats: [1, 1],
    desc: "Inspire: Gain +1/+1.",
    mana: 2,
    tribe: "Beast",
    class: "Neutral",
    rarity: "Free",
    set: "Tests",
    uncollectible: true,

    inspire(plr, game, minion) {
        minion.addStats(1, 1);
    }
}