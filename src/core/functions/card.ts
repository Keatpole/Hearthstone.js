import { Card } from "@Game/internal.js";
import {
	type Blueprint,
	Class,
	Tribe,
	Type,
	type VanillaCard,
} from "@Game/types.js";

const vanilla = {
	/**
	 * Returns all cards added to Vanilla Hearthstone.
	 *
	 * This will throw an error if the user has not run the vanilla card generator,
	 *
	 * @example
	 * const vanillaCards = getAll();
	 *
	 * for (const vanillaCard of vanillaCard) {
	 *     console.log(vanillaCard.dbfId);
	 * }
	 *
	 * @returns The vanilla cards
	 */
	getAll(): VanillaCard[] {
		const fileLocation = "/vanillacards.json";
		if (game.functions.util.fs("exists", fileLocation)) {
			return JSON.parse(
				game.functions.util.fs("read", fileLocation) as string,
			) as VanillaCard[];
		}

		throw new Error(
			"Cards file not found! Run 'bun run script:vanilla:generate' (requires an internet connection), then try again.",
		);
	},

	/**
	 * Filter out some useless vanilla cards
	 *
	 * @param cards The list of vanilla cards to filter
	 * @param uncollectible If it should filter away uncollectible cards
	 * @param dangerous If there are cards with a 'howToEarn' field, filter away any cards that don't have that.
	 *
	 * @returns The filtered cards
	 *
	 * @example
	 * // The numbers here are not accurate, but you get the point.
	 * assert(cards.length, 21022);
	 *
	 * cards = filter(cards, true, true);
	 * assert(cards.length, 1002);
	 *
	 *
	 * @example
	 * // You can get a vanilla card by name using this
	 * cards = cards.filter(c => c.name === "Brann Bronzebeard");
	 * assert(cards.length, 15);
	 *
	 * cards = filter(cards, true, true);
	 * assert(cards.length, 1);
	 */
	filter(
		cards: VanillaCard[],
		uncollectible = true,
		dangerous = false,
		keepHeroSkins = false,
	): VanillaCard[] {
		let vanillaCards = cards;

		if (uncollectible) {
			vanillaCards = vanillaCards.filter((a) => a.collectible);
		}

		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("Prologue"));

		// Idk what 'PVPDR' means, but ok
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("PVPDR"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("DRGA_BOSS"));

		// Battlegrounds
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("BG"));

		// Tavern Brawl
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("TB"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("LOOTA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("DALA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("GILA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("BOTA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("TRLA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("DALA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("ULDA_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("BTA_BOSS_"));
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("Story_"));

		// Book of mercenaries
		vanillaCards = vanillaCards.filter((a) => !a.id.startsWith("BOM_"));
		vanillaCards = vanillaCards.filter(
			(a) => !a.mechanics || !a.mechanics.includes("DUNGEON_PASSIVE_BUFF"),
		);
		vanillaCards = vanillaCards.filter(
			(a) =>
				a.set &&
				!["battlegrounds", "placeholder", "vanilla", "credits"].includes(
					a.set.toLowerCase(),
				),
		);
		vanillaCards = vanillaCards.filter(
			(a) => a.set && !a.set.includes("PLACEHOLDER_"),
		);
		vanillaCards = vanillaCards.filter((a) => !a.mercenariesRole);

		vanillaCards = vanillaCards.filter((a) => !a.battlegroundsBuddyDbfId);
		vanillaCards = vanillaCards.filter(
			(a) => !a.battlegroundsDarkmoonPrizeTurn,
		);
		vanillaCards = vanillaCards.filter((a) => !a.battlegroundsHero);
		vanillaCards = vanillaCards.filter((a) => !a.battlegroundsNormalDbfId);
		vanillaCards = vanillaCards.filter((a) => !a.battlegroundsPremiumDbfId);
		vanillaCards = vanillaCards.filter((a) => !a.battlegroundsSkinParentId);
		vanillaCards = vanillaCards.filter((a) => !a.isBattlegroundsBuddy);

		const filteredCards: VanillaCard[] = [];

		for (const vanillaCard of vanillaCards) {
			// If the set is `HERO_SKINS`, only include it if it's id is `HERO_xx`, where the x's are a number.
			if (vanillaCard.set?.includes("HERO_SKINS")) {
				if (keepHeroSkins && /HERO_\d\d/.test(vanillaCard.id)) {
					filteredCards.push(vanillaCard);
				}

				continue;
			}

			filteredCards.push(vanillaCard);
		}

		vanillaCards = filteredCards;

		if (dangerous) {
			// If any of the cards have a 'howToEarn' field, filter away any cards that don't have that
			const newCards = vanillaCards.filter((a) => a.howToEarn);
			if (newCards.length > 0) {
				vanillaCards = newCards;
			}
		}

		return vanillaCards;
	},
};

export const cardFunctions = {
	/**
	 * Vanilla card related functions
	 */
	vanilla,

	/**
	 * Returns if `classes` includes `cardClass` (also Neutral logic).
	 */
	validateClasses(classes: Class[], cardClass: Class): boolean {
		if (classes.includes(Class.Neutral)) {
			return true;
		}

		return classes.includes(cardClass);
	},

	/**
	 * Returns if the `cardTribe` is `tribe` or 'All'
	 *
	 * @example
	 * assert.equal(card.tribe, "Beast");
	 *
	 * // This should return true
	 * const result = matchTribe(card.tribe, "Beast");
	 * assert.equal(result, true);
	 *
	 * @example
	 * assert.equal(card.tribe, "All");
	 *
	 * // This should return true
	 * const result = matchTribe(card.tribe, "Beast");
	 * assert.equal(result, true);
	 */
	matchTribe(cardTribe: Tribe, tribe: Tribe): boolean {
		// If the card's tribe is "All".
		if (cardTribe === Tribe.All) {
			return true;
		}

		return cardTribe === tribe;
	},

	/**
	 * Validates the blueprints.
	 *
	 * @returns If one or more blueprints were found invalid.
	 */
	runBlueprintValidator(): boolean {
		// Validate the cards
		let valid = true;
		for (const blueprint of game.blueprints) {
			const errorMessage = this.validateBlueprint(blueprint);

			// Success
			if (errorMessage === true) {
				continue;
			}

			// Validation error
			console.log(
				"<red>Card <bold>'%s'</bold> (%s) is invalid since %s</red>",
				blueprint.name,
				blueprint.id,
				errorMessage,
			);
			valid = false;
		}

		return valid;
	},

	/**
	 * Returns all classes in the game
	 */
	getClasses(): Class[] {
		return game.cardCollections.classes.map(
			(heroId) => new Card(heroId, game.player, true).classes[0],
		) as Class[];
	},

	/**
	 * Returns the result of the galakrond formula
	 *
	 * @param invokeCount How many times that the card has been invoked.
	 */
	galakrondFormula(invokeCount: number): number {
		return (
			Math.min(
				4,
				Math.ceil((invokeCount + 1) / 2) + Math.round(invokeCount * 0.15),
			) || 1
		);
	},

	/**
	 * Validates a blueprint
	 *
	 * @returns Success / Error message
	 */
	validateBlueprint(blueprint: Blueprint): string | boolean {
		// These are the required fields for all card types.
		const requiredFieldsTable: { [x in Type]: string[] } = {
			[Type.Minion]: ["attack", "health", "tribe"],
			[Type.Spell]: ["spellSchool"],
			[Type.Weapon]: ["attack", "health"],
			[Type.Hero]: ["armor", "heropowerId"],
			[Type.Location]: ["durability", "cooldown"],
			[Type.HeroPower]: ["heropower"],
			[Type.Undefined]: [],
		};

		// We trust the typescript compiler to do most of the work for us, but the type specific code is handled here.
		const required = requiredFieldsTable[blueprint.type];

		const unwanted = Object.keys(requiredFieldsTable) as unknown as Type[];
		game.functions.util.remove(unwanted, blueprint.type);
		game.functions.util.remove(unwanted, Type.Undefined);

		let result: string | boolean = true;
		for (const field of required) {
			// Field does not exist
			const value = blueprint[field as keyof Blueprint];
			if (!value && value !== 0) {
				result = `<bold>'${field}' DOES NOT</bold> exist for that card.`;
			}
		}

		for (const key of unwanted) {
			const fields = requiredFieldsTable[key as Type];

			for (const field of fields) {
				// We already require that field. For example, both minions and weapons require stats
				if (required.includes(field)) {
					continue;
				}

				// We have an unwanted field

				if (blueprint[field as keyof Blueprint]) {
					result = `<bold>${field} SHOULD NOT</bold> exist on card type ${blueprint.type}.`;
				}
			}
		}

		return result;
	},

	/**
	 * Generates an ids file in `cards/ids.ts`. This is used in `game.cardIds`.
	 *
	 * Don't use this function manually unless you know what you're doing.
	 */
	generateIdsFile(): void {
		let idsContent =
			"// This file has been automatically generated. Do not change this file.\n\n";
		idsContent += "export const cardIds = {\n";
		idsContent += "\tnull0: 0,";

		for (const card of game.cards.sort((a, b) => a.id - b.id)) {
			const numberIdentifier = /^\d/.test(card.name) ? "n" : "";
			idsContent += `\n\t${numberIdentifier}${game.lodash.camelCase(card.name)}${card.id}: ${card.id},`;
		}

		idsContent += "\n};\n";

		game.functions.util.fs("write", "/cards/ids.ts", idsContent);
	},
};
