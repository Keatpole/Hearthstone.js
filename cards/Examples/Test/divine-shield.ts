// Created by the Custom Card Creator

import assert from 'node:assert';
import { type Blueprint } from '@Game/types.js';

export const BLUEPRINT: Blueprint = {
    name: 'Divine Shield Test',
    stats: [1, 1],
    text: '<b>Divine Shield</b>',
    cost: 1,
    type: 'Minion',
    tribe: 'None',
    classes: ['Neutral'],
    rarity: 'Free',
    uncollectible: true,
    id: 73,

    create(plr, self) {
        self.addKeyword('Divine Shield');
    },

    test(plr, self) {
        // There should be no minions on the board
        assert.equal(game.board[plr.id].length, 0);

        // There should be 1 minion on the board
        game.summonMinion(self, plr);
        assert.equal(game.board[plr.id].length, 1);

        // There should be 1 minion on the board since the divine shield saves it
        game.attack(9999, self);
        assert.equal(game.board[plr.id].length, 1);

        // There should be no minions on the board since the divine shield is gone
        game.attack(9999, self);
        assert.equal(game.board[plr.id].length, 0);
    },
};
