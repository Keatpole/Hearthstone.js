// Created by the Vanilla Card Creator

// This is the Flipper Friends Orca card

import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Orca',
    text: '<b>Taunt</b>',
    cost: 6,
    type: 'Minion',
    attack: 6,
    health: 6,
    tribe: 'Beast',
    classes: ['Druid'],
    rarity: 'Free',
    collectible: false,
    id: 96,

    create(plr, self) {
        // Add additional fields here
        self.addKeyword('Taunt');
    },
};
