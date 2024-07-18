/**
 * This is the deck creator.
 * @module Deck Creator
 */
import util from "node:util";
import { Card, createGame } from "@Game/internal.js";
import {
	Class,
	type CommandList,
	type GameConfig,
	Rarity,
	type Type,
} from "@Game/types.js";

const { game, player1 } = createGame();

const { config } = game;
const classes = game.functions.card.getClasses();
const cards = Card.all(game.config.advanced.dcShowUncollectible);

let chosenClass: Class;
let filteredCards: Card[] = [];

let deck: Card[] = [];
let runes = "";

const warnings: Record<string, boolean> = {
	latestCard: true,
};

type Settings = {
	card: {
		history: Card[];
	};
	view: {
		type: "cards" | "deck";
		page: number;
		maxPage?: number;
		cpp: number;
		class?: Class;
	};
	sort: {
		type: keyof Card;
		order: "asc" | "desc";
	};
	search: {
		query: string[];
		prevQuery: string[];
	};
	deckcode: {
		cardId: "id" | "name";
		format: "js" | "vanilla";
	};
	commands: {
		default: string;
		history: string[];
		undoableHistory: string[];
	};
	other: {
		firstScreen: boolean;
	};
};

const settings: Settings = {
	card: {
		history: [],
	},
	view: {
		type: "cards",
		page: 1,
		// Cards per page
		cpp: 15,
	},
	sort: {
		type: "rarity",
		order: "asc",
	},
	search: {
		query: [],
		prevQuery: [],
	},
	deckcode: {
		cardId: "id",
		format: "js",
	},
	commands: {
		default: "add",
		history: [],
		undoableHistory: [],
	},
	other: {
		firstScreen: true,
	},
};

const defaultSettings: Settings = game.lodash.cloneDeep(settings);

/**
 * Shows the watermark for the Deck Creator
 */
function watermark(): void {
	game.interact.cls();
	console.log("Hearthstone.js Deck Creator (C) 2022\n");
}

/**
 * Asks the user which class to choose, and returns it.
 */
function askClass(): Class {
	watermark();

	let heroClass = game.input(
		`What class do you want to choose?\n${classes.join(", ")}\n`,
	);
	if (heroClass) {
		heroClass = game.lodash.startCase(heroClass).replaceAll(" ", "");
	}

	const actualHeroClass = Class[heroClass as keyof typeof Class];

	if (!classes.includes(actualHeroClass)) {
		return askClass();
	}

	player1.heroClass = actualHeroClass;

	if (player1.canUseRunes()) {
		runes = "";

		while (runes.length < 3) {
			watermark();

			const rune = logger.inputTranslate(
				"What runes do you want to add (%s more)\nBlood, Frost, Unholy\n",
				3 - runes.length,
			);
			if (!rune || !["B", "F", "U"].includes(rune[0].toUpperCase())) {
				continue;
			}

			runes += rune[0].toUpperCase();
		}

		player1.runes = runes;
	}

	return actualHeroClass;
}

/**
 * Sort the input cards based on the current `settings`.
 *
 * @returns The sorted cards
 */
function sortCards(_cards: Card[]): Card[] {
	// If the order is invalid, fall back to ascending
	if (!["asc", "desc"].includes(settings.sort.order)) {
		settings.sort.order = defaultSettings.sort.order;
	}

	const { type, order } = settings.sort;

	const calcOrder = (a: number, b: number) => {
		if (order === "asc") {
			return a - b;
		}

		return b - a;
	};

	if (type === "rarity") {
		const sortScores = [
			Rarity.Free,
			Rarity.Common,
			Rarity.Rare,
			Rarity.Epic,
			Rarity.Legendary,
		];

		return _cards.sort((a, b) => {
			const scoreA = sortScores.indexOf(a.rarity);
			const scoreB = sortScores.indexOf(b.rarity);

			return calcOrder(scoreA, scoreB);
		});
	}

	if (["name", "type"].includes(type)) {
		return _cards.sort((a, b) => {
			let typeA: string | Type;
			let typeB: string | Type;

			if (type === "name") {
				typeA = a.name;
				typeB = b.name;
			} else {
				typeA = a.type;
				typeB = b.type;
			}

			let returnValue = typeA.localeCompare(typeB);
			if (order === "desc") {
				returnValue = -returnValue;
			}

			return returnValue;
		});
	}

	if (type === "cost" || type === "id") {
		const newType = type;

		return _cards.sort((a, b) => calcOrder(a[newType], b[newType]));
	}

	// If 'type' isn't valid, fall back to sorting by rarity
	settings.sort.type = defaultSettings.sort.type;
	return sortCards(_cards);
}

/**
 * Searches cards based on a query.
 *
 * # Examples:
 * ```ts
 * let searched = searchCards(cards, 'cost:1');
 * searched = searchCards(cards, 'cost:even');
 * searched = searchCards(cards, 'name:Hi rarity:Legendary');
 *```
 */
function searchCards(_cards: Card[], searchQuery: string): Card[] | false {
	if (searchQuery.length <= 0) {
		return _cards;
	}

	const returnValueCards: Card[] = [];

	const splitQuery = searchQuery.split(":");

	if (splitQuery.length <= 1) {
		// The user didn't specify a key. Do a general search
		const query = splitQuery[0].toLowerCase();

		for (const card of _cards) {
			const name = card.name.toLowerCase();
			const text = card.text.toLowerCase();

			if (!name.includes(query) && !text.includes(query)) {
				continue;
			}

			returnValueCards.push(card);
		}

		return returnValueCards;
	}

	let [key, value] = splitQuery;

	value = value.toLowerCase();

	const doReturn = (c: Card) => {
		const returnValue = c[key as keyof Card];

		// Javascript
		if (!returnValue && returnValue !== 0) {
			console.log("\n<red>Key '%s' not valid!</red>", key);
			return -1;
		}

		// Mana even / odd
		if (key === "cost") {
			if (typeof returnValue !== "number") {
				throw new TypeError("`ret` is not a number.");
			}

			if (value === "even") {
				return returnValue % 2 === 0;
			}

			if (value === "odd") {
				return returnValue % 2 === 1;
			}

			// Mana range (1-10)
			const regex = /\d+-\d+/;
			if (regex.test(value)) {
				const valueSplit = value.split("-");

				const min = game.lodash.parseInt(valueSplit[0]);
				const max = game.lodash.parseInt(valueSplit[1]);

				return returnValue >= min && returnValue <= max;
			}

			const parsedValue = game.lodash.parseInt(value);

			if (!Number.isNaN(parsedValue)) {
				return returnValue === parsedValue;
			}

			console.log("\n<red>Value '%s' not valid!</red>", value);
			return -1;
		}

		if (typeof returnValue === "string") {
			return returnValue.toLowerCase().includes(value);
		}

		if (typeof returnValue === "number") {
			return returnValue === Number.parseFloat(value);
		}

		return -1;
	};

	let error = false;

	for (const card of _cards) {
		if (error) {
			continue;
		}

		const returnValue = doReturn(card);

		if (returnValue === -1) {
			error = true;
			continue;
		}

		if (returnValue) {
			returnValueCards.push(card);
		}
	}

	if (error) {
		return false;
	}

	return returnValueCards;
}

/**
 * Shows the possible cards that the user can add to their deck.
 */
function showCards(): void {
	filteredCards = [];
	watermark();

	// If the user chose to view an invalid class, reset the viewed class to default.
	const correctClass = game.functions.card.validateClasses(
		[settings.view.class ?? chosenClass],
		chosenClass,
	);
	if (!settings.view.class || !correctClass) {
		settings.view.class = chosenClass;
	}

	// Filter away cards that aren't in the chosen class
	for (const card of Object.values(cards)) {
		if (card.runes && !player1.testRunes(card.runes)) {
			continue;
		}

		const correctClass = game.functions.card.validateClasses(
			card.classes,
			settings.view.class ?? chosenClass,
		);
		if (correctClass) {
			filteredCards.push(card);
		}
	}

	if (filteredCards.length <= 0) {
		console.log(
			"<yellow>No cards found for the selected classes '%s and Neutral'.</yellow>",
			chosenClass,
		);
	}

	const { cpp: cardsPerPage } = settings.view;
	let { page } = settings.view;

	// Search

	if (settings.search.query.length > 0) {
		console.log("Searching for '%s'.", settings.search.query.join(" "));
	}

	// Filter to show only cards in the viewed class
	let classCards = Object.values(filteredCards).filter((c) =>
		c.classes.includes(settings.view.class ?? chosenClass),
	);

	if (classCards.length <= 0) {
		console.log(
			"<yellow>No cards found for the viewed class '%s'.</yellow>",
			settings.view.class,
		);
		return;
	}

	let searchFailed = false;

	// Search functionality
	for (const query of settings.search.query) {
		if (searchFailed) {
			continue;
		}

		const searchedCards = searchCards(classCards, query);

		if (searchedCards === false) {
			game.pause(
				`<red>Search failed at '${query}'! Reverting back to last successful query.\n</red>`,
			);
			searchFailed = true;
			continue;
		}

		classCards = searchedCards;
	}

	if (classCards.length <= 0) {
		game.pause("<yellow>\nNo cards match search.\n</yellow>");
		searchFailed = true;
	}

	if (searchFailed) {
		settings.search.query = settings.search.prevQuery;
		showCards();
		return;
	}

	settings.search.prevQuery = settings.search.query;

	settings.view.maxPage = Math.ceil(classCards.length / cardsPerPage);
	if (page > settings.view.maxPage) {
		page = settings.view.maxPage;
	}

	const oldSortType = settings.sort.type;
	const oldSortOrder = settings.sort.order;
	console.log(
		"Sorting by %s, %sending.",
		settings.sort.type.toUpperCase(),
		settings.sort.order,
	);

	// Sort
	classCards = sortCards(classCards);

	const sortTypeInvalid = oldSortType !== settings.sort.type;
	const sortOrderInvalid = oldSortOrder !== settings.sort.order;

	if (sortTypeInvalid) {
		console.log(
			"<yellow>Sorting by </yellow>'%s'<yellow> failed! Falling back to </yellow>%s.",
			oldSortType.toUpperCase(),
			settings.sort.type.toUpperCase(),
		);
	}

	if (sortOrderInvalid) {
		console.log(
			"<yellow>Ordering by </yellow>'%sending'<yellow> failed! Falling back to </yellow>%sending.",
			oldSortOrder,
			settings.sort.order,
		);
	}

	if (sortTypeInvalid || sortOrderInvalid) {
		console.log(
			"\nSorting by %s, %sending.",
			settings.sort.type.toUpperCase(),
			settings.sort.order,
		);
	}

	// Page logic
	classCards = classCards.slice(cardsPerPage * (page - 1), cardsPerPage * page);

	// Loop
	console.log("\nPage %s / %s\n", page, settings.view.maxPage);

	console.log("<underline>%s</underline>", settings.view.class);

	const bricks: string[] = [];
	for (const card of classCards) {
		bricks.push(`${card.name} - ${card.id}`);
	}

	const wall = game.functions.util.createWall(bricks, "-");

	for (const brick of wall) {
		const brickSplit = brick.split("-");

		// Find the card before the '-'
		const card = findCard(brickSplit[0].trim());
		if (!card) {
			continue;
		}

		/*
		 * The card's name should be colored, while the id should not
		 * I don't add colors above, since createWall breaks when colors are used.
		 * ^^^^^^^^ Update 05.06.2024: TODO: This is no longer true, please re-evaluate.
		 */
		const toDisplay = `${card.colorFromRarity(brickSplit[0])}-${brickSplit[1]}`;

		console.log(toDisplay);
	}

	console.log("\nCurrent deckcode output:");
	const deckcode = generateDeckcode();

	if (!deckcode.error) {
		console.log("<bright:green>Valid deck!</bright:green>");
		console.log(deckcode.code);
	}

	if (settings.other.firstScreen) {
		console.log("\nType 'rules' to see a list of rules.");

		settings.other.firstScreen = false;
	}
}

/**
 * Prints the rules / config to the screen
 */
function showRules(): void {
	const configText = "### RULES ###";
	console.log("#".repeat(configText.length));
	console.log(configText);
	console.log("#".repeat(configText.length));

	console.log("#");

	console.log(
		"# Validation: %s",
		logger.translate(
			config.decks.validate
				? "<bright:green>ON</bright:green>"
				: "<red>OFF</red>",
		),
	);

	console.log(
		"#\n# Rule 1. Minimum Deck Length: <yellow>%s</yellow>",
		config.decks.minLength,
	);
	console.log(
		"# Rule 2. Maximum Deck Length: %s <yellow>%s</yellow>",
		config.decks.maxLength,
	);

	console.log(
		"#\n# Rule 3. Maximum amount of cards for each card (eg. You can only have: <yellow>x</yellow> Seances in a deck): <yellow>%s</yellow>",
		config.decks.maxOfOneCard,
	);
	console.log(
		"# Rule 4. Maximum amount of cards for each legendary card (Same as Rule 3 but for legendaries): <yellow>%s</yellow>",
		config.decks.maxOfOneLegendary,
	);

	console.log("#");

	console.log(
		"# There are 3 types of deck states: Valid, Pseudo-Valid, Invalid",
	);
	console.log("# Valid decks will work properly");
	console.log(
		"# Pseudo-valid decks will be rejected by the deck importer for violating a rule",
	);
	console.log(
		"# Invalid decks are decks with a fundemental problem that the deck importer cannot resolve. Eg. An invalid card in the deck.",
	);
	console.log(
		"# Violating any of these rules while validation is enabled will result in a pseudo-valid deck.",
	);

	console.log("#");

	console.log("#".repeat(configText.length));
}

/**
 * Find a card from a name / id.
 *
 * @param cardName The name / id of the card
 */
function findCard(cardName: string): Card | undefined {
	let returnCard: Card | undefined;

	for (const card of Object.values(filteredCards)) {
		if (
			card.id === game.lodash.parseInt(cardName) ||
			(typeof cardName === "string" &&
				card.name.toLowerCase() === cardName.toLowerCase())
		) {
			returnCard = card;
		}
	}

	return returnCard;
}

/**
 * Adds a card to the deck
 */
function add(card: Card): boolean {
	deck.push(card);

	if (!card.deckSettings) {
		return true;
	}

	for (const setting of Object.entries(card.deckSettings)) {
		const [key, value] = setting;

		// biome-ignore lint/suspicious/noExplicitAny: Typescript doesn't allow doing this without that ugly any for some reason. I wrote this code a while ago so i'm not entirely sure.
		config[key as keyof GameConfig] = value as any;
	}

	return true;
}

/**
 * Removes a card from the deck
 */
function remove(card: Card): boolean {
	return game.functions.util.remove(deck, card);
}

/**
 * Shows the cards that are in the users deck. This is a replacement for `showCards`.
 */
function showDeck(): void {
	watermark();

	console.log("Deck Size: <yellow>%s</yellow>\n", deck.length);

	// Why are we doing this? Can't this be done better?
	const cards: Record<number, [Card, number]> = {};

	for (const card of deck) {
		if (!cards[card.id]) {
			cards[card.id] = [card, 0];
		}

		cards[card.id][1]++;
	}

	const bricks: string[] = [];

	for (const cardObject of Object.values(cards)) {
		const card = cardObject[0];
		const amount = cardObject[1];

		let viewed = "";

		if (amount > 1) {
			viewed += `x${amount} `;
		}

		viewed += `${card.name.replaceAll("-", "`")} - ${card.id}`;

		bricks.push(viewed);
	}

	const wall = game.functions.util.createWall(bricks, "-");

	for (const brick of wall) {
		const brickSplit = brick.split("-");

		// Replace '`' with '-'
		brickSplit[0] = brickSplit[0].replaceAll("`", "-");

		const [nameAndAmount, id] = brickSplit;

		// Color name by rarity
		const regex = /^x\d+ /;

		// Extract amount from name
		if (regex.test(nameAndAmount)) {
			// Amount specified
			const amount = nameAndAmount.split(regex);
			const card = findCard(nameAndAmount.replace(regex, "").trim());

			// TODO: Maybe throw an error?
			if (!card) {
				continue;
			}

			const name = card.colorFromRarity(amount[1]);

			const amountString = regex.exec(nameAndAmount) ?? "undefined";
			console.log("%s%s-%s", amountString, name, id);
			continue;
		}

		const card = findCard(nameAndAmount.trim());
		if (!card) {
			continue;
		}

		const name = card.colorFromRarity(nameAndAmount);

		console.log("%s-%s", name, id);
	}

	console.log("\nCurrent deckcode output:");
	const deckcode = generateDeckcode();
	if (!deckcode.error) {
		console.log("<bright:green>Valid deck!</bright:green>");
		console.log(deckcode.code);
	}
}

/**
 * Generates a deckcode from the current deck.
 *
 * @param parseVanillaOnPseudo Converts the deckcode to a vanilla one even if the deck is pseudo-valid. This will decrease performance.
 */
function generateDeckcode(parseVanillaOnPseudo = false) {
	const deckcode = game.functions.deckcode.export(deck, chosenClass, runes);
	const { error } = deckcode;

	if (error) {
		let log = "<yellow>WARNING: ";
		switch (error.msg) {
			case "TooFewCards": {
				log += "Too few cards.";
				break;
			}

			case "TooManyCards": {
				log += "Too many cards.";
				break;
			}

			case "EmptyDeck": {
				log =
					"<red>ERROR: Could not generate deckcode as your deck is empty. The resulting deckcode would be invalid.</red>";
				break;
			}

			case "TooManyCopies": {
				log += util.format(
					"Too many copies of a card. Maximum: </yellow>'%s'<yellow>. Offender: </yellow>'%s'<yellow>",
					config.decks.maxOfOneCard,
					`{ Id: "${error.info?.card?.id}", Copies: "${error.info?.amount}" }`,
				);
				break;
			}

			case "TooManyLegendaryCopies": {
				log += util.format(
					"Too many copies of a Legendary card. Maximum: </yellow>'%s'<yellow>. Offender: </yellow>'%s'<yellow>",
					config.decks.maxOfOneLegendary,
					`{ Id: "${error.info?.card?.id}", Copies: "${error.info?.amount}" }`,
				);
				break;
			}

			default: {
				throw new Error("invalid error message found");
			}
		}

		console.log(log);
	}

	if (
		settings.deckcode.format === "vanilla" &&
		(parseVanillaOnPseudo || !deckcode.error)
	) {
		// Don't convert if the error is unrecoverable
		if (deckcode.error && !deckcode.error.recoverable) {
			return deckcode;
		}

		deckcode.code = game.functions.deckcode.toVanilla(player1, deckcode.code);
	}

	return deckcode;
}

/**
 * Show the help message. To be used by the "help" command.
 */
function help(): void {
	watermark();

	// Commands
	console.log("<b>Available commands:</b>");
	console.log(
		"(In order to run a command; input the name of the command and follow further instruction.)\n",
	);

	const bricks = [
		"(name) [optional] (required) - (description)\n",

		"add (name | id) - Add a card to the deck",
		"remove (card | id) - Remove a card from the deck",
		"view (card | id) - View a card",
		"page (num) - View a different page",
		"cards (class) - Show cards from 'class'",
		"sort (type) [order] - Sorts by 'type' in 'order'ending order. (Type can be: ('rarity', 'name', 'cost', 'id', 'type'), Order can be: ('asc', 'desc')) (Example: sort cost asc - Will show cards ordered by cost cost, ascending.)",
		"search [query] - Searches by query. Keys: ('name', 'text', 'cost', 'rarity', 'id'), Examples: (search the - Search for all cards with the word 'the' in the name or description, case insensitive.), (search cost:2 - Search for all cards that costs 2 cost, search cost:even name:r - Search for all even cost cards with 'r' in its name)",
		"undo - Undo the last action.",
		"deck - Toggle deck-view",
		"deckcode - View the current deckcode",
		"import (deckcode) - Imports a deckcode (Overrides your deck)",
		"set (setting) (value) - Change some settings. Look down to 'Set Subcommands' to see available settings",
		"warning (name) [off | on] - Change some warnings. Look down to 'Warnings' to see available warnings",
		"class - Change the class",
		"eval - Runs some code. Be careful with this, it can be used to break the program",
		"config | rules - Shows the rules for valid decks and invalid decks",
		"help - Displays this message",
		"exit - Quits the program",
	];

	const wall = game.functions.util.createWall(bricks, "-");
	for (const bricks of wall) {
		console.log(bricks);
	}

	// Set
	console.log("\n<b>Set Subcommands:</b>");
	console.log(
		"(In order to use these; input 'set ', then one of the subcommands. Example: 'set cpp 20')\n",
	);

	const setSubcommandBricks = [
		"(name) [optional] (required) - (description)\n",

		"format (format) - Makes the deckcode generator output the deckcode as a different format. If you set this to 'vanilla', it is only going to show the deckcode as vanilla. If you set it to 'vanilla', you will be asked to choose a card if there are multiple vanilla cards with the same name. This should be rare, but just know that it might happen. ('js', 'vanilla') [default = 'js']",
		"cardsPerPage | cpp (num) - How many cards to show per page [default = 15]",
		"defaultCommand | dcmd (cmd) - The command that should run when the command is unspecified. ('add', 'remove', 'view') [default = 'add']",
	];

	const setSubcommandWall = game.functions.util.createWall(
		setSubcommandBricks,
		"-",
	);
	for (const brick of setSubcommandWall) {
		console.log(brick);
	}

	console.log(
		"\n<gray>Note the 'cardsPerPage' commands has 2 different subcommands; cpp & cardsPerPage. Both do the same thing.</gray>",
	);

	// Warning
	console.log("\n<b>Warnings:</b>");
	console.log(
		"(In order to use these; input 'warning (name) [off | on]'. Example: 'warning latestCard off')\n",
	);

	const warningBricks = [
		"(name) - (description)\n",

		"latestCard - Warning that shows up when attemping to use the latest card. The latest card is used if the card chosen in a command is invalid and the name specified begins with 'l'. Example: 'add latest' - Adds a copy of the latest card to the deck.",
	];

	const warningWall = game.functions.util.createWall(warningBricks, "-");
	for (const brick of warningWall) {
		console.log(brick);
	}

	console.log(
		"\nNote: If you don't specify a state (off / on) it will toggle the state of the warning.",
	);
	console.log(
		"Note: The word 'off' can be exchanged with 'disable', 'false', or '0'.",
	);
	console.log(
		"Note: The word 'on' can be exchanged with 'enable', 'true', or '1'.",
	);

	// Notes
	console.log("\n<b>Notes:</b>");

	console.log("Type 'cards Neutral' to see Neutral cards.");
	// TODO: #245 Fix this
	console.log(
		"There is a known bug where if you add 'Prince Renathal', and then remove him, the deck will still require 40 cards. The only way around this is to restart the deck creator.",
	);

	game.pause("\nPress enter to continue...\n");
}

/**
 * Gets a card from arguments
 *
 * @param args Arguments for the command
 * @param callback Callback to run
 * @param errorCallback If the `callback` returns false, run this function.
 *
 * @returns Success
 */
function getCardArg(
	args: string[],
	callback: (card: Card) => boolean,
	errorCallback: () => void,
): boolean {
	let times = 1;

	const cardFromFullString = findCard(args.join(" "));

	// Get x2 from the cmd
	if (args.length > 1 && game.lodash.parseInt(args[0]) && !cardFromFullString) {
		times = game.lodash.parseInt(args[0], 10);
		args.shift();
	}

	const cmd = args.join(" ");

	let eligibleForLatest = false;
	if (cmd.startsWith("l")) {
		eligibleForLatest = true;
	}

	let card = findCard(cmd);

	if (!card && eligibleForLatest) {
		if (warnings.latestCard) {
			game.pause(
				"<yellow>Card not found. Using latest valid card instead.</yellow>",
			);
		}

		card = game.lodash.last(settings.card.history);
	}

	if (!card) {
		game.pause("<red>Invalid card.</red>\n");
		return false;
	}

	for (let i = 0; i < times; i++) {
		if (!callback(card)) {
			errorCallback();
		}
	}

	settings.card.history.push(card);
	return true;
}

/**
 * Runs the correct command based on the input.
 *
 * @param cmd The user input
 * @param addToHistory If it should add the command to the history
 *
 * @returns Success
 */
function handleCmds(cmd: string, addToHistory = true): boolean {
	if (findCard(cmd)) {
		// You just typed the name of a card.
		return handleCmds(`${settings.commands.default} ${cmd}`);
	}

	const args = cmd.split(" ");
	const name = args.shift()?.toLowerCase();
	if (!name) {
		game.pause("<red>Invalid command.</red>\n");
		return false;
	}

	let foundCommand = false;

	if (game.interact.shouldExit(name)) {
		running = false;
		return true;
	}

	const commandName = Object.keys(commands).find(
		(commandName) => commandName === name,
	);

	if (commandName) {
		foundCommand = true;
		commands[commandName](args);
	}

	if (!foundCommand) {
		// Infer add
		const tryCommand = `${settings.commands.default} ${cmd}`;
		console.log(
			"<yellow>Unable to find command. Trying '%s'</yellow>",
			tryCommand,
		);
		return handleCmds(tryCommand);
	}

	if (!addToHistory) {
		return true;
	}

	settings.commands.history.push(cmd);
	if (["a", "r"].includes(cmd[0])) {
		settings.commands.undoableHistory.push(cmd);
	}

	return true;
}

let running = true;

/**
 * Runs the deck creator.
 */
export function main(): void {
	running = true;
	Card.registerAll();

	chosenClass = askClass();

	while (running) {
		if (settings.view.type === "cards") {
			showCards();
		} else if (settings.view.type === "deck") {
			showDeck();
		}

		handleCmds(game.input("\n> "));
	}
}

const commands: CommandList = {
	add(args): boolean {
		let success = true;

		getCardArg(args, add, () => {
			// Internal error since add shouldn't return false
			console.log(
				"<red>Internal Error: Something went wrong while adding a card. Please report this. Error code: DcAddInternal</red>",
			);
			game.pause();

			success = false;
		});

		if (!success) {
			return false;
		}

		return true;
	},
	remove(args): boolean {
		let success = true;

		getCardArg(args, remove, () => {
			// User error
			console.log("<red>Invalid card.</red>");
			game.pause();

			success = false;
		});

		if (!success) {
			return false;
		}

		return true;
	},
	page(args): boolean {
		let page = game.lodash.parseInt(args.join(" "));
		if (!page) {
			return false;
		}

		if (page < 1) {
			page = 1;
		}

		settings.view.page = page;

		return true;
	},
	config(): boolean {
		watermark();
		showRules();
		game.pause("\nPress enter to continue...\n");

		return true;
	},
	rules(args, flags): boolean {
		return commands.config(args, flags) as boolean;
	},
	view(args): boolean {
		// The callback function doesn't return anything, so we don't do anything with the return value of `getCardArg`.
		getCardArg(
			args,
			(card) => {
				card.view();
				return true;
			},
			() => {
				// Pass
			},
		);

		return true;
	},
	cards(args): boolean {
		if (args.length <= 0) {
			return false;
		}

		let heroClass = args.join(" ") as Class;
		heroClass = game.lodash.startCase(heroClass) as Class;

		if (
			!classes.includes(heroClass as CardClassNoNeutral) &&
			heroClass !== "Neutral"
		) {
			game.pause("<red>Invalid class!</red>\n");
			return false;
		}

		const correctClass = game.functions.card.validateClasses(
			[heroClass],
			chosenClass,
		);
		if (!correctClass) {
			game.pause(
				`<yellow>Class '${heroClass}' is a different class. To see these cards, please switch class from '${chosenClass}' to '${heroClass}' to avoid confusion.</yellow>\n`,
			);
			return false;
		}

		settings.view.class = heroClass;

		return true;
	},
	deckcode(): boolean {
		const deckcode = generateDeckcode(true);

		let toPrint = `${deckcode.code}\n`;
		if (deckcode.error && !deckcode.error.recoverable) {
			toPrint = "";
		}

		game.pause(toPrint);

		return true;
	},
	sort(args): boolean {
		if (args.length <= 0) {
			return false;
		}

		settings.sort.type = args[0] as keyof Card;
		if (args.length > 1) {
			settings.sort.order = args[1] as "asc" | "desc";
		}

		return true;
	},
	search(args): boolean {
		if (args.length <= 0) {
			settings.search.query = [];
			return false;
		}

		settings.search.query = args;

		return true;
	},
	deck(): boolean {
		settings.view.type = settings.view.type === "cards" ? "deck" : "cards";

		return true;
	},
	import(args): boolean {
		const deckcode = args.join(" ");

		config.decks.validate = false;
		let newDeck = game.functions.deckcode.import(player1, deckcode);
		config.decks.validate = true;

		if (!newDeck) {
			return false;
		}

		newDeck = newDeck.sort((a, b) => a.name.localeCompare(b.name));

		deck = [];

		// Update the filtered cards
		chosenClass = player1.heroClass as CardClassNoNeutral;
		runes = player1.runes;
		showCards();

		/*
		 * Add the cards using handleCmds instead of add because for some reason, adding them with add
		 * causes a weird bug that makes modifying the deck impossible because removing a card
		 * removes a completly unrelated card because javascript.
		 * You can just set deck = functions.importDeck(), but doing it that way doesn't account for renathal or any other card that changes the config in any way since that is done using the add function.
		 */
		for (const card of newDeck) {
			handleCmds(`add ${card.id}`);
		}

		return true;
	},
	class(): boolean {
		const oldRunes = game.lodash.clone(runes);
		const newClass = askClass();

		if (newClass === chosenClass && runes === oldRunes) {
			game.pause("<yellow>Your class was not changed</yellow>\n");
			return false;
		}

		deck = [];
		chosenClass = newClass;
		if (settings.view.class !== "Neutral") {
			settings.view.class = chosenClass;
		}

		return true;
	},
	undo(): boolean {
		if (settings.commands.undoableHistory.length <= 0) {
			game.pause("<red>Nothing to undo.</red>\n");
			return false;
		}

		const commandSplit = game.lodash
			.last(settings.commands.undoableHistory)
			?.split(" ");
		if (!commandSplit) {
			game.pause(
				"<red>Could not find anything to undo. This is a bug.</red>\n",
			);
			return false;
		}

		const args = commandSplit.slice(1);
		const command = commandSplit[0];

		let reverse: string;

		if (command.startsWith("a")) {
			reverse = "remove";
		} else if (command.startsWith("r")) {
			reverse = "add";
		} else {
			// This shouldn't ever happen, but oh well
			console.log("<red>Command '%s' cannot be undoed.</red>", command);
			return false;
		}

		handleCmds(`${reverse} ${args.join(" ")}`, false);

		settings.commands.undoableHistory.pop();
		settings.commands.history.pop();

		return true;
	},
	help(): boolean {
		help();

		return true;
	},
	warning(args): boolean {
		const key = args[0];

		if (!Object.keys(warnings).includes(key)) {
			game.pause(`<red>'${key}' is not a valid warning!</red>\n`);
			return false;
		}

		let newState: boolean;

		if (args.length <= 1) {
			// Toggle
			newState = !warnings[key];
		} else {
			const value = args[1];

			if (["off", "disable", "false", "no", "0"].includes(value)) {
				newState = false;
			} else if (["on", "enable", "true", "yes", "1"].includes(value)) {
				newState = true;
			} else {
				game.pause(
					`<red>${value} is not a valid state. View 'help' for more information.</red>\n`,
				);
				return false;
			}
		}

		if (warnings[key] === newState) {
			const newStateName = newState ? "enabled" : "disabled";

			game.pause(
				`<yellow>Warning '<bright:yellow>${key}</bright:yellow>' is already ${newStateName}.</yellow>\n`,
			);
			return false;
		}

		warnings[key] = newState;

		const newStateName = newState
			? "<bright:green>Enabled warning</bright:green>"
			: "<red>Disabled warning</red>";
		game.pause(`${newStateName} <yellow>'${key}'</yellow>\n`);

		return true;
	},
	set(args): boolean {
		if (args.length <= 0) {
			console.log("<yellow>Too few arguments</yellow>");
			game.pause();
			return false;
		}

		const setting = args.shift();

		switch (setting) {
			case "format": {
				if (args.length === 0) {
					settings.deckcode.format = defaultSettings.deckcode.format;
					console.log(
						"Reset deckcode format to: <yellow>%s</yellow>",
						defaultSettings.deckcode.format,
					);
					break;
				}

				if (!["vanilla", "js"].includes(args[0])) {
					console.log("<red>Invalid format!</red>");
					game.pause();
					return false;
				}

				settings.deckcode.format = args[0] as "vanilla" | "js";
				console.log("Set deckcode format to: <yellow>%s</yellow>", args[0]);
				break;
			}

			case "cpp":
			case "cardsPerPage": {
				if (args.length === 0) {
					settings.view.cpp = defaultSettings.view.cpp;
					console.log(
						"Reset cards per page to: <yellow>%s</yellow>",
						defaultSettings.view.cpp,
					);
					break;
				}

				settings.view.cpp = game.lodash.parseInt(args[0]);
				break;
			}

			case "dcmd":
			case "defaultCommand": {
				if (args.length === 0) {
					settings.commands.default = defaultSettings.commands.default;
					console.log(
						"Set default command to: <yellow>%s</yellow>",
						defaultSettings.commands.default,
					);
					break;
				}

				if (!["add", "remove", "view"].includes(args[0])) {
					return false;
				}

				const command = args[0];

				settings.commands.default = command;
				console.log("Set default command to: <yellow>%s</yellow>", command);
				break;
			}

			default: {
				game.pause(`<red>'${setting}' is not a valid setting.</red>\n`);
				return false;
			}
		}

		game.pause("<bright:green>Setting successfully changed!<bright:green>\n");

		return true;
	},
	eval(args): boolean {
		if (args.length <= 0) {
			game.pause("<red>Too few arguments.</red>\n");
			return false;
		}

		const code = game.interact.parseEvalArgs(args);

		try {
			// biome-ignore lint/security/noGlobalEval: This is a security issue yes, but it's a debug command.
			eval(code);
		} catch (error) {
			if (!(error instanceof Error)) {
				throw new TypeError("`error` is not an instance of Error");
			}

			console.log(
				"\n<red>An error happened while running this code! Here is the error:</red>",
			);

			// The stack includes "<anonymous>", which would be parsed as a tag, which would cause another error
			game.functions.color.parseTags = false;
			console.log(error.stack);
			game.functions.color.parseTags = true;

			game.pause();
		}

		game.event.broadcast(Event.Eval, code, game.player);
		return true;
	},
};
