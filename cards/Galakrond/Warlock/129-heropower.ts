// Created by the Custom Card Creator

import assert from "node:assert";
import { Card } from "@Game/internal.js";
import type { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
	name: "Galakrond's Malice",
	text: "Summon two 1/1 Imps.",
	cost: 2,
	type: "Heropower",
	classes: ["Warlock"],
	rarity: "Legendary",
	collectible: false,
	id: 129,

	async heropower(owner, self) {
		// Summon two 1/1 Imps.
		for (let i = 0; i < 2; i++) {
			const card = await Card.create(game.cardIds.draconicImp21, owner);
			if (!card) {
				break;
			}

			await owner.summon(card);
		}
	},

	async test(owner, self) {
		const countImps = () => owner.board.filter((card) => card.id === 21).length;

		// There should be 0 imps by default
		assert.equal(countImps(), 0);

		// There should be 2 imps when using the hero power
		await self.activate("heropower");
		assert.equal(countImps(), 2);
	},
};
