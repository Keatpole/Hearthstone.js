module.exports = {
    name: "The Lich King's Goal",
    displayName: "Death and Decay",
    desc: "Deal 3 damage to all enemies.",
    mana: 3,
    class: "Death Knight",
    rarity: "Free",
    set: "Knights of the Frozen Throne",
    spellClass: "Shadow",
    uncollectible: true,
    id: 125,

    cast(plr, game, self) {
        game.board[plr.getOpponent().id].forEach(m => {
            game.attack(3, m);
        });

        game.attack(3, plr.getOpponent());
    }
}
