// Created by Hand

import assert from "node:assert";
import type { AbilityCallback, Blueprint } from "@Game/types.js";

/*
 * This is another way to write blueprints
 * You might want to do this if you make a very complicated card
 * however it is not _as_ supported by scripts as the default method.
 */
const battlecry: AbilityCallback = (owner, self) => {
	self.addStats(1, 1);
};

const theTestAbility: AbilityCallback = (owner, self) => {
	self.activate("battlecry");

	assert.equal((self.blueprint.attack ?? 0) + 1, self.attack);
	assert.equal((self.blueprint.health ?? 0) + 1, self.health);
};

export const blueprint: Blueprint = {
	name: "Another Ability Example",
	text: "<b>Battlecry:</b> Give this minion +1/+1.",
	cost: 1,
	type: "Minion",
	classes: ["Neutral"],
	rarity: "Free",
	collectible: false,
	id: 77,

	attack: 1,
	health: 2,
	tribe: "None",

	// If the function is named correctly, you can just write the name of the ability
	battlecry,

	// Otherwise, do `nameOfAbility: nameOfFunction`.
	test: theTestAbility,
};
