import { Card, type Player } from "@Game/internal.js";

import {
	type CardLike,
	Class,
	type FunctionsExportDeckError,
	type GameConfig,
	Rarity,
	type VanillaCard,
} from "@Game/types.js";

// To decode vanilla deckcodes
import deckstrings from "deckstrings";

export const deckcodeFunctions = {
	/**
	 * Imports a deck using a code and put the cards into the player's deck
	 *
	 * @param player The player to put the cards into the deck of
	 * @param code The deck code
	 *
	 * @returns The deck
	 */
	import(player: Player, code: string): Card[] | undefined {
		const panic = (errorCode: string, cardName?: string) => {
			console.log(
				"<red>This deck is not valid!\nError Code: <yellow>%s</yellow red>",
				errorCode,
			);
			if (cardName) {
				console.log(
					"<red>Specific Card that caused this error: <yellow>%s</yellow red>",
					cardName,
				);
			}

			game.pause();
		};

		let vanilla = false;

		try {
			// If this doesn't crash, this is a vanilla deckcode
			deckstrings.decode(code);

			vanilla = true;
		} catch {
			// This isn't a vanilla code, no worries, just parse it as a hearthstone.js deckcode.
		}

		let actualCode = code;

		// We don't convert the code in the try-catch block, since this function could throw an error which would be ignored
		if (vanilla) {
			actualCode = this.fromVanilla(player, actualCode);
		}

		// BFU
		const runeRegex = /\[[BFU]{3}]/;

		// BBB -> 3B
		const runeRegexAlternative = /\[3[BFU]]/;

		const runesExists =
			runeRegex.test(actualCode) || runeRegexAlternative.test(actualCode);

		let sep = " /";

		if (runesExists) {
			sep = " [";
		}

		const hero = actualCode.split(sep)[0].trim();

		actualCode = sep[1] + actualCode.split(sep)[1];

		const heroClass =
			Class[
				game.lodash.startCase(hero).replaceAll(" ", "") as keyof typeof Class
			];

		if (!game.functions.card.getClasses().includes(heroClass)) {
			panic("INVALIDHERO");
			return;
		}

		player.heroClass = heroClass;
		const runeClass = player.canUseRunes();

		const addRunes = (runes: string) => {
			if (runeClass) {
				player.runes = runes;
			} else {
				game.pause(
					`<yellow>WARNING: This deck has runes in it, but the class is <bright:yellow>${hero}</bright:yellow>.\n`,
				);
			}
		};

		// Runes
		if (runeRegexAlternative.test(actualCode)) {
			// [3B]
			const rune = actualCode[2];

			actualCode = actualCode.slice(5);
			addRunes(rune.repeat(3));
		} else if (runeRegex.test(actualCode)) {
			// [BFU]
			let runes = "";

			for (let i = 1; i <= 3; i++) {
				runes += actualCode[i];
			}

			actualCode = actualCode.slice(6);
			addRunes(runes);
		} else if (runeClass) {
			game.pause(
				`<yellow>WARNING: This class supports runes but there are no runes in this deck. This deck's class: <bright:yellow>${hero}</bright:yellow>.\n`,
			);
		}

		// Find /3:5,2:8,1/
		const copyDefinitionFormat = /\/(\d+:\d+,)*\d+\/ /;
		if (!copyDefinitionFormat.test(actualCode)) {
			panic("COPYDEFNOTFOUND");
			return;
		}

		const copyDefinition = actualCode.split("/")[1];

		actualCode = actualCode.replace(copyDefinitionFormat, "");

		const deck = actualCode.split(",");
		const newDeck: Card[] = [];

		const localSettings = JSON.parse(JSON.stringify(game.config)) as GameConfig;

		let processed = 0;
		let returnValueInvalid = false;

		for (const copyDefinitionSplitObject of copyDefinition.split(",")) {
			const definition = copyDefinitionSplitObject.split(":");

			const copies = definition[0];
			const times = Number.isNaN(game.lodash.parseInt(definition[1]))
				? deck.length
				: game.lodash.parseInt(definition[1]);

			const cards = deck.slice(processed, times);

			for (const cardId of cards) {
				const id = game.lodash.parseInt(cardId, 36);

				const blueprint = Card.fromID(id);
				if (!blueprint) {
					panic("NONEXISTANTCARD", id.toString());
					returnValueInvalid = true;
					continue;
				}

				const card = new Card(blueprint.id, player, true);

				for (let i = 0; i < game.lodash.parseInt(copies); i++) {
					newDeck.push(card.perfectCopy());
				}

				if (card.deckSettings) {
					for (const setting of Object.entries(card.deckSettings)) {
						const [key, value] = setting;

						// HACK: Never usage
						localSettings[key as keyof GameConfig] = value as never;
					}
				}

				const validationError = card.validateForDeck();

				if (!localSettings.decks.validate || validationError === true) {
					continue;
				}

				let error: string;

				switch (validationError) {
					case "class": {
						error = "You have a card from a different class in your deck";
						break;
					}

					case "uncollectible": {
						error = "You have an uncollectible card in your deck";
						break;
					}

					case "runes": {
						error = "A card does not support your current runes";
						break;
					}

					default: {
						throw new Error(
							"Unknown error code when validating a card in a deck",
						);
					}
				}

				game.pause(
					`<red>${error}.\nSpecific Card that caused the error: <yellow>${card.name} (${card.id})</yellow red>\n`,
				);
				returnValueInvalid = true;
			}

			if (returnValueInvalid) {
				continue;
			}

			processed += times;
		}

		if (returnValueInvalid) {
			return undefined;
		}

		const max = localSettings.decks.maxLength;
		const min = localSettings.decks.minLength;

		if (
			(newDeck.length < min || newDeck.length > max) &&
			localSettings.decks.validate
		) {
			const grammar =
				min === max
					? `exactly <yellow>${max}</yellow>`
					: `between <yellow>${min}-${max}</yellow>`;
			game.pause(
				`<red>The deck needs ${grammar} cards. Your deck has: <yellow>${newDeck.length}</yellow>.\n`,
			);
			return undefined;
		}

		// Check if you have more than 2 cards or more than 1 legendary in your deck. (The numbers can be changed in the config)
		const cards: Record<string, number> = {};
		for (const card of newDeck) {
			if (!cards[card.id]) {
				cards[card.id] = 0;
			}

			cards[card.id]++;
		}

		for (const cardObject of Object.entries(cards)) {
			const amount = cardObject[1];
			const cardName = cardObject[0];

			let errorcode: string | undefined;
			if (amount > localSettings.decks.maxOfOneCard) {
				errorcode = "normal";
			}

			if (
				Card.fromName(cardName, game.player)?.rarity === Rarity.Legendary &&
				amount > localSettings.decks.maxOfOneLegendary
			) {
				errorcode = "legendary";
			}

			if (!localSettings.decks.validate || !errorcode) {
				continue;
			}

			let error: string;
			switch (errorcode) {
				case "normal": {
					error = `<red>There are more than <yellow>${localSettings.decks.maxOfOneCard}</yellow> of a card in your deck.</red>`;
					break;
				}

				case "legendary": {
					error = `<red>There are more than <yellow>${localSettings.decks.maxOfOneLegendary}</yellow> of a legendary card in your deck.</red>`;
					break;
				}

				default: {
					error = "";
					break;
				}
			}

			throw new Error(
				`${error}\n<red>Specific card that caused this error: <yellow>${cardName}</yellow>. Amount: <yellow>${amount}</yellow>.\n`,
			);
		}

		player.deck = newDeck;
		player.shuffleDeck();

		return newDeck;
	},

	/**
	 * Generates a deckcode from a list of blueprints
	 *
	 * @param deck The deck to create a deckcode from
	 * @param heroClass The class of the deck. Example: "Priest"
	 * @param runes The runes of the deck. Example: "BFU"
	 *
	 * @returns The deckcode, An error message alongside any additional information.
	 */
	export(
		deck: CardLike[],
		heroClass: string,
		runes: string,
	): { code: string; error: FunctionsExportDeckError } {
		let error: FunctionsExportDeckError;

		if (deck.length < game.config.decks.minLength) {
			error = {
				msg: "TooFewCards",
				info: { amount: deck.length },
				recoverable: true,
			};
		}

		if (deck.length > game.config.decks.maxLength) {
			error = {
				msg: "TooManyCards",
				info: { amount: deck.length },
				recoverable: true,
			};
		}

		if (deck.length <= 0) {
			// Unrecoverable error
			error = { msg: "EmptyDeck", info: undefined, recoverable: false };

			return { code: "", error };
		}

		let deckcode = `${heroClass} `;

		if (runes) {
			// If the runes is 3 of one type, write, for example, 3B instead of BBB
			deckcode +=
				new Set(...runes).size === 1 ? `[3${runes[0]}] ` : `[${runes}] `;
		}

		deckcode += "/";

		let cards: Array<[CardLike, number]> = [];

		for (const card of deck) {
			const found = cards.find((a) => a[0].id === card.id);

			if (found) {
				cards[cards.indexOf(found)][1]++;
			} else {
				cards.push([card, 1]);
			}
		}

		// Sort
		cards = cards.sort((a, b) => a[1] - b[1]);

		let lastCopy = 0;
		for (const cardObject of cards) {
			const [card, copies] = cardObject;

			if (copies === lastCopy) {
				continue;
			}

			let amount = 0;
			let last = false;

			for (const [index, cardObject] of cards.entries()) {
				if (cardObject[1] !== copies) {
					continue;
				}

				if (index + 1 === cards.length) {
					last = true;
				}

				amount++;
			}

			lastCopy = copies;

			deckcode += last ? copies : `${copies}:${amount},`;

			if (
				copies > game.config.decks.maxOfOneLegendary &&
				card.rarity === Rarity.Legendary
			) {
				error = {
					msg: "TooManyLegendaryCopies",
					info: { card, amount: copies },
					recoverable: true,
				};
			} else if (copies > game.config.decks.maxOfOneCard) {
				error = {
					msg: "TooManyCopies",
					info: { card, amount: copies },
					recoverable: true,
				};
			}
		}

		deckcode += "/ ";

		deckcode += cards.map((c) => c[0].id.toString(36)).join(",");

		return { code: deckcode, error };
	},

	/**
	 * Turns a Hearthstone.js deckcode into a vanilla deckcode
	 *
	 * @param player The player that will get the deckcode
	 * @param code The deckcode
	 * @param extraFiltering If it should do extra filtering when there are more than 1 possible card. This may choose the wrong card.
	 *
	 * @returns The vanilla deckcode
	 */
	toVanilla(player: Player, code: string, extraFiltering = true): string {
		/*
		 * HACK: Jank code ahead. Beware!
		 *
		 * Reference: Death Knight [3B] /1:4,2/ 3f,5f,6f...
		 */

		const deck: deckstrings.DeckDefinition = {
			cards: [],
			heroes: [],
			format: 1,
		};

		// List of vanilla heroes dbfIds
		const vanillaHeroes: { [key in Class]?: number } = {
			[Class.Warrior]: 7,
			[Class.Hunter]: 31,
			[Class.Druid]: 274,
			[Class.Mage]: 637,
			[Class.Paladin]: 671,
			[Class.Priest]: 813,
			[Class.Warlock]: 893,
			[Class.Rogue]: 930,
			[Class.Shaman]: 1066,
			[Class.DemonHunter]: 56_550,
			[Class.DeathKnight]: 78_065,
		};

		const codeSplit = code.split(/[[/]/);
		const heroClass =
			Class[
				game.lodash
					.startCase(codeSplit[0].trim())
					.replaceAll(" ", "") as keyof typeof Class
			];

		const heroClassId = vanillaHeroes[heroClass];
		if (!heroClassId) {
			throw new Error(`Invalid hero class: ${heroClass}`);
		}

		deck.heroes.push(heroClassId);

		// Remove the class
		codeSplit.splice(0, 1);

		// Remove runes
		if (codeSplit[0].endsWith("] ")) {
			codeSplit.splice(0, 1);
		}

		const amountString = codeSplit[0].trim();
		const cards = codeSplit[1].trim();

		// Now it's just the cards left
		const vanillaCards = game.functions.card.vanilla.getAll();

		const cardsSplit = cards.split(",").map((i) => game.lodash.parseInt(i, 36));
		const cardsSplitId = cardsSplit.map(Card.fromID);
		const cardsSplitCard = cardsSplitId.map((c) => {
			if (!c) {
				throw new Error("c is an invalid card");
			}

			return new Card(c.id, player, true);
		});
		const trueCards = cardsSplitCard.map((c) => c.name);

		// Cards is now a list of names
		const newCards: Array<[number, number]> = [];

		for (const [index, cardName] of trueCards.entries()) {
			let amount = 1;

			// Find how many copies to put in the deck
			const amountStringSplit = amountString.split(":");

			let found = false;
			for (const [index2, amountFromString] of amountStringSplit.entries()) {
				if (found) {
					continue;
				}

				// We only want to look at every other one
				if (index2 % 2 === 0) {
					continue;
				}

				if (index >= game.lodash.parseInt(amountFromString)) {
					continue;
				}

				// This is correct
				found = true;

				amount = game.lodash.parseInt(
					amountStringSplit[amountStringSplit.indexOf(amountFromString) - 1],
				);
			}

			if (!found) {
				const character = amountString.at(-1);
				amount = game.lodash.parseInt(character ?? "0");
			}

			let matches = vanillaCards.filter(
				(a) => a.name.toLowerCase() === cardName.toLowerCase(),
			);
			matches = game.functions.card.vanilla.filter(
				matches,
				true,
				extraFiltering,
			);

			if (matches.length === 0) {
				// Invalid card
				game.pause("<red>ERROR: Invalid card found!</red>\n");
				continue;
			}

			let match: VanillaCard;

			if (matches.length > 1) {
				// Ask the user to pick one
				for (const [index, vanillaCard] of matches.entries()) {
					vanillaCard.elite = undefined;

					// All cards here should already be collectible
					vanillaCard.collectible = undefined;
					vanillaCard.artist = undefined;
					vanillaCard.mechanics = undefined;

					// Just look at `m.races`
					vanillaCard.race = undefined;
					vanillaCard.referencesTags = undefined;

					console.log("%s:", index + 1);
					console.log(vanillaCard);
				}

				console.log(
					"<yellow>Multiple cards with the name '</yellow>%s<yellow>' detected! Please choose one:</yellow>",
					cardName,
				);
				const chosen = game.input();

				match = matches[game.lodash.parseInt(chosen) - 1];
			} else {
				match = matches[0];
			}

			newCards.push([match.dbfId, amount]);
		}

		deck.cards = newCards;

		const encodedDeck = deckstrings.encode(deck);
		return encodedDeck;
	},

	/**
	 * Turns a vanilla deckcode into a Hearthstone.js deckcode
	 *
	 * @param player The player that will get the deckcode
	 * @param code The deckcode
	 *
	 * @returns The Hearthstone.js deckcode
	 */
	fromVanilla(player: Player, code: string): string {
		// Use the 'deckstrings' library's decode
		const deckWithFormat: deckstrings.DeckDefinition = deckstrings.decode(code);

		const vanillaCards = game.functions.card.vanilla.getAll();

		// We don't care about the format
		const { format, ...deck } = deckWithFormat;

		const heroClass = vanillaCards.find(
			(a) => a.dbfId === deck.heroes[0],
		)?.cardClass;
		let heroClassName = game.lodash.capitalize(
			heroClass?.toString() ?? Class[game.player2.heroClass],
		);

		// Wtf hearthstone?
		if (heroClassName === "Deathknight") {
			heroClassName = "Death Knight";
		}

		if (heroClassName === "Demonhunter") {
			heroClassName = "Demon Hunter";
		}

		// Get the full card object from the dbfId
		const deckDefinition: Array<[VanillaCard | undefined, number]> =
			deck.cards.map((c) => [vanillaCards.find((a) => a.dbfId === c[0]), c[1]]);
		const createdCards: Card[] = Card.all(true);

		const invalidCards: VanillaCard[] = [];
		for (const vanillaCardObject of deckDefinition) {
			const vanillaCard = vanillaCardObject[0];
			if (!vanillaCard || typeof vanillaCard === "number") {
				continue;
			}

			if (
				createdCards.some(
					(card) =>
						card.name === vanillaCard.name || card.name === vanillaCard.name,
				)
			) {
				continue;
			}

			if (invalidCards.includes(vanillaCard)) {
				continue;
			}

			// The card doesn't exist.
			console.error(
				`<red>ERROR: Card <yellow>${vanillaCard.name} <bright:yellow>(${vanillaCard.dbfId})</yellow bright:yellow> doesn't exist!</red>`,
			);
			invalidCards.push(vanillaCard);
		}

		if (invalidCards.length > 0) {
			/*
			 * There was a card in the deck that isn't implemented in Hearthstone.js
			 * Add a newline
			 */
			console.error();
			throw new Error(
				"Some cards do not currently exist. You cannot play on this deck without them.",
			);
		}

		let newDeck: Array<[Card, number]> = [];

		// All cards in the deck exists
		const amounts: Record<number, number> = {};
		for (const vanillaCardObject of deckDefinition) {
			const [vanillaCard, amount] = vanillaCardObject;
			if (!vanillaCard || typeof vanillaCard === "number") {
				continue;
			}

			const name = vanillaCards.find(
				(a) => a.dbfId === vanillaCard.dbfId,
			)?.name;

			if (!name) {
				throw new Error("Could not get name from card in deckdefinition");
			}

			// TODO: Use ids instead
			const card = Card.fromName(name, player);
			if (!card) {
				throw new Error("Invalid card name");
			}

			newDeck.push([card, amount]);

			if (!amounts[amount]) {
				amounts[amount] = 0;
			}

			amounts[amount]++;
		}

		// Sort the `newDeck` array, lowest amount first
		newDeck = newDeck.sort((a, b) => a[1] - b[1]);

		// Assemble Hearthstone.js deckcode.
		let deckcode = `${heroClassName} `;

		// Generate runes
		let runes = "";

		player.heroClass =
			Class[
				game.lodash
					.startCase(heroClassName)
					.replaceAll(" ", "") as keyof typeof Class
			];

		if (player.canUseRunes()) {
			for (const cardAmountObject of newDeck) {
				const card = cardAmountObject[0];

				if (!card.runes) {
					continue;
				}

				runes += card.runes;
			}

			let sortedRunes = "";

			if (runes.includes("B")) {
				sortedRunes += "B";
			}

			if (runes.includes("F")) {
				sortedRunes += "F";
			}

			if (runes.includes("U")) {
				sortedRunes += "U";
			}

			runes = runes.replace("B", "");
			runes = runes.replace("F", "");
			runes = runes.replace("U", "");

			sortedRunes += runes;

			// Only use the first 3 characters
			runes = sortedRunes.slice(0, 3);

			if (runes === "") {
				runes = "3B";
			}

			if (runes.startsWith(runes[1]) && runes[1] === runes[2]) {
				runes = `3${runes[0]}`;
			}

			deckcode += `[${runes}] `;
		}

		deckcode += "/";

		// Amount format
		for (const entry of Object.entries(amounts)) {
			const [key, amount] = entry;

			// If this is the last amount
			deckcode += amounts[game.lodash.parseInt(key) + 1]
				? `${key}:${amount},`
				: key;
		}

		deckcode += "/ ";

		deckcode += newDeck.map((c) => c[0].id.toString(36)).join(",");

		return deckcode;
	},
};
