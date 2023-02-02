module.exports = {
    name: "Rancor",
    desc: "Deal 2 damage to all minions. Gain 2 Armor for each destroyed.",
    mana: 4,
    class: "Warrior",
    rarity: "Epic",
    set: "Forged in the Barrens",
    id: 115,

    cast(plr, game, self) {
        game.board.forEach(p => {
            p.forEach(m => {
                game.attack(2, m)
                if (m.getHealth() <= 0) plr.armor += 2;
            });
        });
    }
}
