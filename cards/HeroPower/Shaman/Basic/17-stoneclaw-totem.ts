// Created by Hand (before the Card Creator Existed)

import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Stoneclaw Totem',
    text: '<b>Taunt</b>',
    cost: 1,
    type: 'Minion',
    attack: 0,
    health: 2,
    tribe: 'Totem',
    classes: ['Shaman'],
    rarity: 'Free',
    uncollectible: true,
    id: 17,

    create(plr, self) {
        self.addKeyword('Taunt');
    },
};
