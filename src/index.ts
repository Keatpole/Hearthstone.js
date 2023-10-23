/**
 * The entry point of the game.
 *
 * Hearthstone.js - Hearthstone but console based.
 * Copyright (C) 2022  LunarTides
 *
 * @module Index
 */

import process from 'node:process';
import { type Dirent } from 'node:fs';
import { validate as validateIds } from '../scripts/id/lib.js';
import { createGame } from './internal.js';

export function main() {
    const { game, player1, player2 } = createGame();

    game.interact.info.watermark();

    // Find holes and dupes in the ids
    game.logWarn('Validating ids...');
    const [holes, dupes] = validateIds(true);
    if (holes > 0 || dupes > 0) {
        // If there were holes or dupes, pause the game so that the user gets a
        // chance to see what the problem was
        game.pause();
    }

    warnAboutOutdatedCards();

    // Ask the players for deck codes.
    for (const plr of [player1, player2]) {
        if (plr.deck.length > 0) {
            continue;
        }

        // Put this in a while loop to make sure the function repeats if it fails.
        while (!game.interact.deckCode(plr)) {
            // Pass
        }
    }

    game.startGame();

    game.interact.card.mulligan(player1);
    game.interact.card.mulligan(player2);

    try {
        // Game loop
        while (game.running) {
            game.interact.gameLoop.doTurn();
        }
    } catch (error) {
        if (!(error instanceof Error)) {
            throw new TypeError('error is not of error type when catching from gameloop');
        }

        // Create error report file
        game.functions.util.createLogFile(error);

        throw error;
    }
}

let outdatedCards: string[] = [];
const outdatedExtensions: string[] = [];
const updatedCards: string[] = [];
function warnAboutOutdatedCards() {
    // TODO: This doesn't quite work. #336
    findOutdatedCards(game.functions.util.dirname() + '/cards');
    outdatedCards = outdatedCards.filter(card => !updatedCards.includes(card));

    if (outdatedCards.length <= 0 && outdatedExtensions.length <= 0) {
        return;
    }

    for (const p of outdatedCards) {
        game.logWarn(`<yellow>WARNING: Outdated card found: ${p}.js</yellow>`);
    }

    for (const p of outdatedExtensions) {
        game.logWarn(`<yellow>WARNING: Outdated extension found: ${p}.mts. Please change all card file names ending with the '.mts' extension to '.ts' instead.</yellow>`);
    }

    game.logWarn('Run the `upgradecards` script to automatically update outdated cards from pre 2.0.');
    game.logWarn('This will only upgrade pre 2.0 cards to 2.0 cards.');
    game.logWarn('You can play the game without upgrading the cards, but the cards won\'t be registered.');
    game.logWarn('Run the script by running `npm run script:upgradecards`.');

    const proceed = game.input('\nDo you want to proceed? ([y]es, [n]o): ').toLowerCase().startsWith('y');
    if (!proceed) {
        process.exit(0);
    }
}

function findOutdatedCards(path: string) {
    if (path.includes('cards/Test')) {
        return;
    }

    for (const file of game.functions.util.fs('readdir', path, { withFileTypes: true }) as Dirent[]) {
        const p = `${path}/${file.name}`.replace('/dist/..', '');

        if (file.name.endsWith('.mts')) {
            outdatedExtensions.push(p.slice(0, -4));
        }

        if (file.name.endsWith('.js')) {
            outdatedCards.push(p.slice(0, -3));
        }

        if (file.name.endsWith('.ts')) {
            updatedCards.push(p.slice(0, -3));
        } else if (file.isDirectory()) {
            findOutdatedCards(p);
        }
    }
}
