/**
 * This is the custom card creator.
 * @module Custom Card Creator
 */

import { createGame } from "@Game/internal.js";
import {
	type Blueprint,
	type BlueprintWithOptional,
	type Class,
	type Keyword,
	type Rarity,
	type SpellSchool,
	type Tribe,
	Type,
} from "@Game/types.js";
import rl from "readline-sync";
import * as lib from "./lib.js";

const { player1, game } = createGame();

let shouldExit = false;
let type: Type;

/**
 * Asks the user a question and returns the result.
 * This is a wrapper for `game.input` that might set the global `shouldExit` variable.
 */
function input(prompt: string): string {
	if (shouldExit) {
		return "";
	}

	const returnValue = game.input(prompt);

	if (game.interact.shouldExit(returnValue)) {
		shouldExit = true;
	}

	return returnValue;
}

/**
 * Parses user input, `_card`, into a working card that can be passed to the library.
 */
function applyCard(_card: BlueprintWithOptional): Blueprint {
	const newCard = {} as Blueprint;

	for (const entry of Object.entries(_card)) {
		let [key, value] = entry;

		// These are the required fields and their default values.
		const defaults = {
			name: "CHANGE THIS",
			text: "",
			cost: 0,
			classes: ["Neutral"],
			rarity: "Free",
			attack: 1,
			health: 1,
			tribe: "None",
			spellSchool: "None",
			armor: 5,
			heropowerId: 0,
			durability: 2,
			cooldown: 2,
		};

		let valueUndefined = !value;

		// If the value is an array, the value is undefined if every element is falsy
		valueUndefined ||= Array.isArray(value) && value.every((v) => !v);

		// The value should not be undefined if it is 0
		valueUndefined &&= value !== 0;

		// Don't include the key if the value is falsy, unless the key is required.
		const defaultValue = game.lodash.get(defaults, key);
		if (defaultValue !== undefined && valueUndefined) {
			value = defaultValue;
			valueUndefined = false;
		}

		if (valueUndefined) {
			continue;
		}

		// HACK: Well, it is not ts-expect-error at least
		newCard[key as keyof Blueprint] = value as never;
	}

	return newCard;
}

/**
 * Asks the user questions that apply to every card type.
 */
function common(): BlueprintWithOptional {
	const name = input("Name: ");
	const text = input("Text: ");
	const cost = game.lodash.parseInt(input("Cost: "));
	const classes = input("Classes: ") as Class;
	const rarity = input("Rarity: ") as Rarity;
	const keywords = input("Keywords: ");

	player1.heroClass = classes;

	let runes = "";
	if (player1.canUseRunes()) {
		runes = input("Runes: ");
	}

	let realKeywords: Keyword[] | undefined;
	if (keywords) {
		realKeywords = keywords.split(", ") as Keyword[];
	}

	return {
		name,
		text,
		cost,
		type,
		classes: [classes],
		rarity,
		runes,
		keywords: realKeywords,
		collectible: true,
		id: 0,
	};
}

const cardTypeFunctions: { [x in Type]: () => Blueprint } = {
	[Type.Minion](): Blueprint {
		const card = common();

		const attack = game.lodash.parseInt(input("Attack: "));
		const health = game.lodash.parseInt(input("Health: "));
		const tribe = input("Tribe: ") as Tribe;

		return applyCard({
			...card,
			attack,
			health,
			tribe,
		});
	},

	[Type.Spell](): Blueprint {
		const card = common();

		const spellSchool = input("Spell School: ") as SpellSchool;

		return applyCard({
			...card,
			spellSchool,
		});
	},

	[Type.Weapon](): Blueprint {
		const card = common();

		const attack = game.lodash.parseInt(input("Attack: "));
		const health = game.lodash.parseInt(input("Health: "));

		return applyCard({
			...card,
			attack,
			health,
		});
	},

	[Type.Hero](): Blueprint {
		const card = common();

		const armor = game.lodash.parseInt(game.input("Armor (Default: 5):")) ?? 5;

		console.log("Make the Hero Power:");
		if (!main()) {
			throw new Error("Failed to create hero power");
		}

		return applyCard({
			...card,
			armor,
			heropowerId: lib.getLatestId(),
		});
	},

	[Type.Location](): Blueprint {
		const card = common();

		const durability = game.lodash.parseInt(
			input(
				"Durability (How many times you can trigger this location before it is destroyed): ",
			),
		);
		const cooldown =
			game.lodash.parseInt(input("Cooldown (Default: 2): ")) ?? 2;

		return applyCard({
			...card,
			durability,
			cooldown,
		});
	},

	[Type.HeroPower](): Blueprint {
		const card = common();

		return applyCard(card);
	},

	[Type.Undefined](): Blueprint {
		throw new TypeError("Undefined type");
	},
};

/**
 * Asks the user a series of questions, and creates a custom card using it.
 * This is not meant to be a library. Running this function will temporarily give control to this function.
 *
 * @returns The path to the file
 */
export function main(debug = false, overrideType?: lib.CcType): string | false {
	// Reset the shouldExit switch so that the program doesn't immediately exit when the user enters the ccc, exits, then enters ccc again
	shouldExit = false;

	console.log("Hearthstone.js Custom Card Creator (C) 2022\n");
	console.log("type 'back' at any step to cancel.\n");

	// Ask the user for the type of card they want to make
	type = game.lodash.startCase(input("Type: ")) as Type;
	if (shouldExit) {
		return false;
	}

	if (!Object.keys(cardTypeFunctions).includes(type)) {
		console.log("That is not a valid type!");
		game.pause();
		return false;
	}

	// HACK: Use of never
	const cardFunction: () => Blueprint = cardTypeFunctions[type as never];
	const card = cardFunction();

	if (shouldExit) {
		return false;
	}

	// Ask the user if the card should be uncollectible
	const uncollectible = rl.keyInYN("Uncollectible?");
	if (uncollectible) {
		card.collectible = !uncollectible;
	}

	// Actually create the card
	console.log("Creating file...");

	let cctype: lib.CcType = "Custom";
	if (overrideType) {
		cctype = overrideType;
	}

	const filePath = lib.create(cctype, card, undefined, undefined, debug);

	game.pause();
	return filePath;
}
