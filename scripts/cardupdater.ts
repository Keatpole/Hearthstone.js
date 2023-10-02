/**
 * The card updater script.
 * @module Card Updater
 */

import { Card, createGame } from "../src/internal.js";
import { Blueprint, VanillaCard } from "../src/types.js";

const { game, player1, player2 } = createGame();

function main() {
    const [vanillaCards, error] = game.functions.getVanillaCards();

    if (error) {
        game.input(error);
        process.exit(1);
    }

    const filteredVanillaCards = game.functions.filterVanillaCards(vanillaCards, false, false);
    const customCards = game.functions.getCards(false);

    customCards.forEach(custom => {
        // Find the equivalent vanilla card 
        let vanilla = filteredVanillaCards.find(vanilla => {
            return (
                vanilla.name.toLowerCase() == game.interact.getDisplayName(custom).toLowerCase() &&
                vanilla.type.toLowerCase() == custom.type.toLowerCase()
            );
        });

        // There is no vanilla version of that card.
        if (!vanilla) return;

        Object.entries(custom).forEach(ent => {
            const [key, val] = ent;

            // HACK: For some reason, typescript thinks that vanilla can be undefined
            vanilla = vanilla!;

            if (key == "stats") {
                check("attack", val[0].toString(), vanilla, custom);
                check("health", val[1].toString(), vanilla, custom);
                return;
            }

            vanilla.text = vanilla.text?.replaceAll("\n", " ");
            vanilla.text = vanilla.text?.replaceAll("[x]", "");

            check(key, val, vanilla, custom);
        });
    });

    function check(key: string, val: any, vanilla: VanillaCard, card: Card) {
        const ignore = ["id", "set", "name", "rarity", "type"];

        const table: {[key in keyof Blueprint]?: keyof VanillaCard} = {
            "text": "text"
        }

        let vanillaValue: any = key as keyof VanillaCard;
        if (!vanillaValue) vanillaValue = table[key as keyof Blueprint];
        vanillaValue = vanilla[vanillaValue as keyof VanillaCard];

        if (!vanillaValue || ignore.includes(key)) return;
        if (val.toString().toLowerCase() == vanillaValue?.toString().toLowerCase()) return;

        game.log("Card outdated!");
        game.log(`Name: ${card.name}`);
        game.log(`Local: "${key}: ${val}"`);
        game.log(`New:   "${key}: ${vanillaValue}"\n`);
    }
}

main();
