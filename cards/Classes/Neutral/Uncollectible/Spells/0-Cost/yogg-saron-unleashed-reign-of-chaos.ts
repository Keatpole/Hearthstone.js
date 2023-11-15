// Created by the Vanilla Card Creator

import assert from 'node:assert';
import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Yogg-Saron Unleashed Reign of Chaos',
    text: 'Take control of an enemy minion.',
    cost: 0,
    type: 'Spell',
    spellSchool: 'None',
    classes: ['Neutral'],
    rarity: 'Free',
    uncollectible: true,
    displayName: 'Reign of Chaos',
    id: 108,

    cast(plr, self) {
        // Take control of an enemy minion.
        const card = game.interact.selectCardTarget(self.text, self, 'enemy');
        if (!card) {
            return game.constants.refund;
        }

        card.takeControl(plr);
        return true;
    },

    test(plr, self) {
        // TODO: Add proper tests. #325
        return true;
    },
};
