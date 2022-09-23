module.exports = {
    name: "Aquatic Form",
    desc: "Dredge. If you have the Mana to play the card this turn, draw it.",
    mana: 0,
    class: "Druid",
    rarity: "Rare",
    set: "Voyage to the Sunken City",

    cast(plr, game, card) {
        let c = game.functions.dredge();

        if (plr.mana >= c.mana) {
            plr.drawCard();
        }
    }
}