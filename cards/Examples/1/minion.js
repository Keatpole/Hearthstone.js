// Created by Hand

/**
 * This is so you can get auto-completion if you're using Visual Studio Code.
 * This will automatically show up if you created this card using the card creator or any of it's variants (Custom, Vanilla, Class)
 * @type {import("../../../src/types").Blueprint}
 */
module.exports = {
    name: "Minion Example", // The name of the card. It MUST be unique.
    stats: [2, 1], // The stats. The first number is its attack, and the second number is its health.
    desc: "Just an example card (Does nothing)", // The description of the card. This can be anything.
    mana: 1, // How much the card costs.
    type: "Minion", // What type the card is: "Minion" or "Spell" or "Weapon", etc...
    tribe: "None", // What tribe the minion is: "Undead" or "Naga" or "Beast", etc...
    class: "Neutral", // What class the card belongs to: "Neutral", "Warrior", "Hunter", etc...
    rarity: "Free", // The rarity of the card: "Free", "Common", "Rare", etc...
    uncollectible: true // If the card should not be allowed in decks, or in card pools. These example cards should not be randomly generated in `discover`, or added in a deck, so all of them are uncollectible.
}
