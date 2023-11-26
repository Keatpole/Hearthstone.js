// Created by the Custom Card Creator

import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Titan Example',
    text: '<b>Titan</b>.',
    cost: 1,
    type: 'Minion',
    attack: 10,
    health: 10,
    tribe: 'None',
    classes: ['Neutral'],
    rarity: 'Free',
    uncollectible: true,
    id: 78,

    create(plr, self) {
        // Put the ids of the titan ability cards, like in corrupt, but a list.
        self.addKeyword('Titan', [79, 80, 81]);
    },

    test(plr, self) {
        // TODO: Add proper tests. #325
        return true;
    },
};
