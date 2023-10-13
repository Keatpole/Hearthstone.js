// Created by the Custom Card Creator

import {type Blueprint} from '@Game/types.js';
import {Card} from '../../src/core/card.js';

export const blueprint: Blueprint = {
    name: 'Galakrond the Unbreakable',
    displayName: 'Galakrond, the Unbreakable',
    text: '<b>Battlecry:</b> Draw {amount} minion{plural}. Give {plural2} +4/+4.',
    cost: 7,
    type: 'Hero',
    classes: ['Warrior'],
    rarity: 'Legendary',
    hpText: 'Give your hero +3 Attack this turn.',
    hpCost: 2,
    id: 69,

    battlecry(plr, self) {
        // Draw 1 minion. Give them +4/+4.
        const amount = game.functions.card.galakrondFormula(self.storage.invokeCount);

        // Draw the minions
        for (let i = 0; i < amount; i++) {
            const card = plr.drawCard();
            if (!(card instanceof Card)) {
                continue;
            }

            // Give it +4/+4
            card.addStats(4, 4);
        }
    },

    heropower(plr, self) {
        // Give your hero +3 Attack this turn.

        plr.attack += 3;
    },

    invoke(plr, self) {
        game.functions.card.galakrondBump(self, 'invokeCount');
    },

    placeholders(plr, self) {
        if (!self.storage.invokeCount) {
            return {amount: 0, plural: 's', plural2: 'They'};
        }

        const amount = game.functions.card.galakrondFormula(self.storage.invokeCount);
        const multiple = amount > 1;

        const plural = multiple ? 's' : '';
        const plural2 = multiple ? 'them' : 'it';

        return {amount, plural, plural2};
    },
};
