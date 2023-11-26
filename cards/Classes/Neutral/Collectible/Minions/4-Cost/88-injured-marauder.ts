// Created by the Vanilla Card Creator

import assert from 'node:assert';
import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Injured Marauder',
    text: '<b>Taunt. Battlecry:</b> Deal 6 damage to this minion.',
    cost: 4,
    type: 'Minion',
    attack: 5,
    health: 10,
    tribe: 'None',
    classes: ['Neutral'],
    rarity: 'Common',
    id: 88,

    create(plr, self) {
        // Add additional fields here
        self.addKeyword('Taunt');
    },

    battlecry(plr, self) {
        // Taunt Battlecry: Deal 6 damage to this minion.
        game.attack(6, self);
    },

    test(plr, self) {
        // TODO: Add proper tests. #325
        return true;
    },
};
