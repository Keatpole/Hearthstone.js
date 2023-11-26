// Created by the Custom Card Creator

import assert from 'node:assert';
import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Gul\'dan',
    text: 'Warlock starting hero',
    cost: 0,
    type: 'Hero',
    hpText: 'Draw a card and take 2 damage.',
    hpCost: 2,
    classes: ['Warlock'],
    rarity: 'Free',
    uncollectible: true,
    id: 11,

    heropower(plr, self) {
        // Draw a card and take 2 damage.

        // Deal 2 damage to the player.
        game.attack(2, plr);
        plr.drawCard();
    },

    test(plr, self) {
        // Clear the player's hand
        plr.hand = [];

        // The player should have no cards in their hand, and should have 30 health
        assert.equal(plr.hand.length, 0);
        assert.equal(plr.health, 30);

        self.activate('heropower');

        // The player should now have 1 card in their hand, and 28 health.
        assert.equal(plr.hand.length, 1);
        assert.equal(plr.health, 30 - 2);
    },
};
