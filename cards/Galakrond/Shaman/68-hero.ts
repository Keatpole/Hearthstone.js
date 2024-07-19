// Created by the Custom Card Creator

import { Card } from "@Game/internal.js";
import type { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
	name: "Galakrond, the Tempest",
	text: "<b>Battlecry:</b> Summon two {amount}/{amount} Storms with <b>Rush</b>.{weapon}",
	cost: 7,
	type: "Hero",
	classes: ["Shaman"],
	rarity: "Legendary",
	collectible: true,
	id: 68,

	armor: 5,
	heropowerId: 126,

	battlecry(owner, self) {
		// Summon two 1/1 Storms with Rush. (Equip a 5/2 Claw.)

		// Get the stats
		const amount = game.functions.card.galakrondFormula(
			self.storage.invokeCount as number,
		);

		const shouldGiveWeapon = amount >= 7;

		// Summon the two minions
		for (let i = 0; i < 2; i++) {
			const minion = new Card(game.cardIds.brewingStorm112, owner);
			if (!minion) {
				break;
			}

			minion.setStats(amount, amount);
			owner.summon(minion);
		}

		if (!shouldGiveWeapon) {
			return;
		}

		// Give the weapon
		const weapon = new Card(game.cardIds.dragonClaw111, owner);
		owner.setWeapon(weapon);
	},

	invoke(owner, self) {
		self.galakrondBump("invokeCount");
	},

	placeholders(owner, self) {
		if (!self.storage.invokeCount) {
			return { amount: 0, plural: "s", plural2: "They" };
		}

		const amount = game.functions.card.galakrondFormula(
			self.storage.invokeCount as number,
		);

		const weapon = amount >= 7 ? " Equip a 5/2 Claw." : "";

		return { amount, weapon };
	},
};
