// Created by the Custom Card Creator

import { type Blueprint } from '@Game/types.js';
import { Card } from '../../src/core/card.js';

export const blueprint: Blueprint = {
    name: 'Galakrond, the Nightmare',
    text: '<b>Battlecry:</b> Draw {amount} card{plural}. {plural2} costs (0).',
    cost: 7,
    type: 'Hero',
    classes: ['Rogue'],
    rarity: 'Legendary',
    hpText: 'Add a <b>Lackey</b> to your hand.',
    hpCost: 2,
    id: 67,

    battlecry(plr, self) {
        // Draw {amount} cards. They cost (0).

        // Get the amount of cards to draw
        const amount = game.functions.card.galakrondFormula(self.storage.invokeCount as number);

        for (let i = 0; i < amount; i++) {
            const card = plr.drawCard();
            if (!(card instanceof Card)) {
                return;
            }

            // Set the cost to 0
            card.addEnchantment('cost = 0', self);
        }
    },

    heropower(plr, self) {
        // Add a lacky to your hand.
        const lackeyId = game.lodash.sample(game.cardCollections.lackeys);
        if (!lackeyId) {
            return;
        }

        const lackey = game.createCard(lackeyId, plr);

        plr.addToHand(lackey);
    },

    invoke(plr, self) {
        self.galakrondBump('invokeCount');
    },

    placeholders(plr, self) {
        if (!self.storage.invokeCount) {
            return { amount: 0, plural: 's', plural2: 'They' };
        }

        const amount = game.functions.card.galakrondFormula(self.storage.invokeCount as number);
        const multiple = amount > 1;

        const plural = multiple ? 's' : '';
        const plural2 = multiple ? 'They' : 'It';

        return { amount, plural, plural2 };
    },
};
