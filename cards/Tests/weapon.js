module.exports = {
    name: "Test Weapon",
    stats: [5, 3],
    desc: "",
    mana: 1,
    class: "Warrior",
    rarity: "Rare",
    set: "Tests",

    battlecry(plr, game, card) {
        console.log("Test");
        console.log(game.player1.name)
    }
}