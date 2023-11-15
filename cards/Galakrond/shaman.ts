// Created by the Custom Card Creator

import { type Blueprint } from '@Game/types.js';

export const blueprint: Blueprint = {
    name: 'Galakrond the Tempest',
    displayName: 'Galakrond, the Tempest',
    text: '<b>Battlecry:</b> Summon two {amount}/{amount} Storms with <b>Rush</b>.{weapon}',
    cost: 7,
    type: 'Hero',
    classes: ['Shaman'],
    rarity: 'Legendary',
    hpText: 'Summon a 2/1 Elemental with <b>Rush</b>.',
    hpCost: 2,
    id: 68,

    battlecry(plr, self) {
        // Summon two 1/1 Storms with Rush. (Equip a 5/2 Claw.)

        // Get the stats
        const amount = game.functions.card.galakrondFormula(self.storage.invokeCount as number);
        const shouldGiveWeapon = amount >= 7;

        // Summon the two minions
        for (let i = 0; i < 2; i++) {
            const minion = game.createCard('Brewing Storm', plr);
            if (!minion) {
                break;
            }

            minion.setStats(amount, amount);
            game.summonMinion(minion, plr);
        }

        if (!shouldGiveWeapon) {
            return;
        }

        // Give the weapon
        const weapon = game.createCard('Dragon Claw', plr);
        plr.setWeapon(weapon);
    },

    heropower(plr, self) {
        // Summon a 2/1 Elemental with Rush.
        const card = game.createCard('Windswept Elemental', plr);
        if (!card) {
            return;
        }

        game.summonMinion(card, plr);
    },

    invoke(plr, self) {
        self.galakrondBump('invokeCount');
    },

    placeholders(plr, self) {
        if (!self.storage.invokeCount) {
            return { amount: 0, plural: 's', plural2: 'They' };
        }

        const amount = game.functions.card.galakrondFormula(self.storage.invokeCount as number);
        const weapon = amount >= 7 ? ' Equip a 5/2 Claw.' : '';

        return { amount, weapon };
    },
};
