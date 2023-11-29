/**
 * This is the vanilla card creator.
 * @module Vanilla Card Creator
 */

import rl from 'readline-sync';
import { type Card as VanillaCard } from '@hearthstonejs/vanillatypes';
import { type Blueprint, type CardClass, type CardRarity, type MinionTribe, type SpellSchool } from '../../src/types.js';
import { createGame } from '../../src/internal.js';
import * as lib from './lib.js';

const { game } = createGame();

/**
 * Create a card from a vanilla card.
 *
 * @param card The vanilla card
 * @param debug If it should use debug mode
 */
// eslint-disable-next-line complexity
export function create(card: VanillaCard, debug: boolean, overrideType?: lib.CcType): void {
    // Harvest info
    let cardClass = game.lodash.capitalize(card.cardClass ?? 'Neutral') as CardClass;
    const collectible = card.collectible ?? false;
    const cost = card.cost ?? 0;
    const { name } = card;
    let rarity: CardRarity = 'Free';
    if (card.rarity) {
        rarity = game.lodash.capitalize(card.rarity) as CardRarity;
    }

    let text = card.text ?? '';
    let type = game.lodash.capitalize(card.type);
    if (type === 'Hero_power') {
        type = 'Spell';
    }

    // Minion info
    const attack = card.attack ?? -1;
    const health = card.health ?? -1;
    let races: MinionTribe[] = [];
    if (card.races) {
        races = card.races.map(r => game.lodash.capitalize(r) as MinionTribe);
    }

    // Spell info
    let spellSchool: SpellSchool = 'None';
    if (card.spellSchool) {
        spellSchool = game.lodash.capitalize(card.spellSchool) as SpellSchool;
    }

    // Weapon Info
    const durability = card.durability ?? -1;

    // Modify the text
    text = text.replaceAll('\n', ' ');
    text = text.replaceAll('[x]', '');

    const classes = game.functions.card.getClasses() as CardClass[];
    classes.push('Neutral');

    while (!classes.includes(cardClass)) {
        cardClass = game.lodash.startCase(game.input('<red>Was not able to find the class of this card.\nWhat is the class of this card? </red>')) as CardClass;
    }

    if (type === 'Hero') {
        // Add the hero power
        game.log('<green>Adding the hero power</green>');

        const heroPower = game.functions.card.vanilla.getAll().find(c => c.dbfId === card.heroPowerDbfId);
        if (!heroPower) {
            throw new Error('No hero power found');
        }

        create(heroPower, debug);
    }

    let blueprint: Blueprint;

    switch (type) {
        case 'Minion': {
            blueprint = {
                name,
                text,
                cost,
                type,
                attack,
                health,
                // TODO: Add support for more than 1 tribe. #334
                tribe: races[0] || 'None',
                classes: [cardClass],
                rarity,
                id: 0,
            };

            break;
        }

        case 'Spell': {
            blueprint = {
                name,
                text,
                cost,
                type,
                spellSchool,
                classes: [cardClass],
                rarity,
                id: 0,
            };

            break;
        }

        case 'Weapon': {
            blueprint = {
                name,
                text,
                cost,
                type,
                attack,
                health: durability,
                classes: [cardClass],
                rarity,
                id: 0,
            };

            break;
        }

        case 'Hero': {
            blueprint = {
                name,
                text,
                cost,
                type,
                heropowerId: lib.getLatestId(),
                classes: [cardClass],
                rarity,
                id: 0,
            };

            break;
        }

        case 'Location': {
            blueprint = {
                name,
                text,
                cost,
                type,
                durability: health,
                cooldown: 2,
                classes: [cardClass],
                rarity,
                id: 0,
            };

            break;
        }

        default: {
            throw new TypeError(`${type} is not a valid type!`);
        }
    }

    if (!collectible) {
        blueprint.uncollectible = true;
    }

    let cctype: lib.CcType = 'Vanilla';
    if (overrideType) {
        cctype = overrideType;
    }

    lib.create(cctype, type, blueprint, undefined, undefined, debug);
}

/**
 * Prompt the user to pick a card, then create it.
 *
 * @returns If a card was created
 */
export function main(debug = false, overrideType?: lib.CcType): boolean {
    game.log('Hearthstone.js Vanilla Card Creator (C) 2022\n');

    const vanillaCards = game.functions.card.vanilla.getAll();

    if (game.config.general.debug) {
        debug = !rl.keyInYN('Do you want the card to actually be created?');
    }

    let running = true;
    while (running) {
        const cardName = game.input('\nName / dbfId (Type \'back\' to cancel): ');
        if (game.interact.shouldExit(cardName)) {
            running = false;
            break;
        }

        let filteredCards = vanillaCards.filter(c => c.name.toLowerCase() === cardName.toLowerCase() || c.dbfId === game.lodash.parseInt(cardName));
        filteredCards = game.functions.card.vanilla.filter(filteredCards, false, true);

        if (filteredCards.length <= 0) {
            game.log('Invalid card.\n');
            continue;
        }

        let card;

        if (filteredCards.length > 1) {
            // Prompt the user to pick one
            for (const [index, vanillaCard] of filteredCards.entries()) {
                // Get rid of useless information
                delete vanillaCard.elite;
                delete vanillaCard.heroPowerDbfId;
                delete vanillaCard.artist;
                delete vanillaCard.flavor;
                delete vanillaCard.mechanics;

                const { id, ...card } = vanillaCard;

                game.log(`\n${index + 1}:`);
                game.log(card);
            }

            const picked = game.lodash.parseInt(game.input(`Pick one (1-${filteredCards.length}): `));
            if (!picked || !filteredCards[picked - 1]) {
                game.log('Invalid number.\n');
                continue;
            }

            card = filteredCards[picked - 1];
        } else {
            card = filteredCards[0];
        }

        game.log(`Found '${card.name}'\n`);

        create(card, debug, overrideType);
    }

    return true;
}
