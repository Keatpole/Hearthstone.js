import { Card, type Player } from "@Game/internal.js";
import { Ability, Type } from "@Game/types.js";

export const cardInteract = {
	/**
	 * Asks the user to select a location card to use, and activate it.
	 *
	 * @returns Success
	 */
	useLocation():
		| boolean
		| "nolocations"
		| "invalidtype"
		| "cooldown"
		| "refund" {
		const locations = game.player.board.filter((m) => m.type === Type.Location);
		if (locations.length <= 0) {
			return "nolocations";
		}

		const location = game.interact.selectCardTarget(
			"Which location do you want to use?",
			undefined,
			"friendly",
			["allowLocations"],
		);
		if (!location) {
			return "refund";
		}

		if (location.type !== Type.Location) {
			return "invalidtype";
		}

		if (location.cooldown && location.cooldown > 0) {
			return "cooldown";
		}

		if (location.activate(Ability.Use) === Card.REFUND) {
			return "refund";
		}

		if (location.durability === undefined) {
			throw new Error("Location card's durability is undefined");
		}

		location.durability -= 1;
		location.cooldown = location.backups.init.cooldown;
		return true;
	},

	/**
	 * Asks the player to mulligan their cards
	 *
	 * @param player The player to ask
	 *
	 * @returns A string of the indexes of the cards the player mulligan'd
	 */
	mulligan(player: Player): string {
		game.interact.info.showGame(player);

		let sb = "\nChoose the cards to mulligan (1, 2, 3, ...):\n";
		if (!game.config.general.debug) {
			sb +=
				"<gray>(Example: 13 will mulligan the cards with the ids 1 and 3, 123 will mulligan the cards with the ids 1, 2 and 3, just pressing enter will not mulligan any cards):</gray>\n";
		}

		const input = player.ai ? player.ai.mulligan() : game.input(sb);
		player.mulligan(input);

		return input;
	},

	/**
	 * Asks the current player a `prompt` and shows 3 cards from their deck for the player to choose, the chosen card will be added to the top of their deck
	 *
	 * @param prompt The prompt to ask the user
	 *
	 * @returns The card chosen
	 */
	dredge(prompt = "Choose a card to Dredge:"): Card | undefined {
		// Look at the bottom three cards of the deck and put one on the top.
		const cards = game.player.deck.slice(0, 3);

		// Check if ai
		if (game.player.ai) {
			const card = game.player.ai.dredge(cards);
			if (!card) {
				return undefined;
			}

			// Removes the selected card from the players deck.
			game.functions.util.remove(game.player.deck, card);
			game.player.deck.push(card);

			return card;
		}

		game.interact.info.showGame(game.player);

		console.log("\n%s", prompt);

		if (cards.length <= 0) {
			return undefined;
		}

		for (const [index, card] of cards.entries()) {
			console.log(card.readable(index + 1));
		}

		const choice = game.input("> ");

		const cardId = game.lodash.parseInt(choice) - 1;
		const card = cards[cardId];

		if (!card) {
			return this.dredge(prompt);
		}

		// Removes the selected card from the players deck.
		game.functions.util.remove(game.player.deck, card);
		game.player.deck.push(card);

		return card;
	},

	/**
	 * Asks the user a "prompt", show them "amount" cards. The cards are chosen from "cards".
	 *
	 * @param prompt The prompt to ask
	 * @param cards The cards to choose from
	 * @param filterClassCards If it should filter away cards that do not belong to the player's class. Keep this at default if you are using `functions.card.getAll()`, disable this if you are using either player's deck / hand / graveyard / etc...
	 * @param amount The amount of cards to show
	 * @param _static_cards Do not use this variable, keep it at default
	 *
	 * @returns The card chosen.
	 */
	discover(
		prompt: string,
		cards: Card[] = [],
		filterClassCards = true,
		amount = 3,
		_static_cards: Card[] = [],
	): Card | undefined {
		let actualCards = cards;

		game.interact.info.showGame(game.player);
		let values: Card[] = _static_cards;

		if (actualCards.length <= 0) {
			actualCards = Card.all();
		}

		if (actualCards.length <= 0 || !actualCards) {
			return undefined;
		}

		if (filterClassCards) {
			/*
			 * We need to filter the cards
			 * of the filter function
			 */
			actualCards = actualCards.filter((card) =>
				game.functions.card.validateClasses(
					card.classes,
					game.player.heroClass,
				),
			);
		}

		// No cards from previous discover loop, we need to generate new ones.
		if (_static_cards.length === 0) {
			values = game.lodash.sampleSize(actualCards, amount);
			values = values.map((c) => {
				if (c instanceof Card) {
					c.perfectCopy();
				}

				return c;
			});
		}

		if (values.length <= 0) {
			return undefined;
		}

		if (game.player.ai) {
			return game.player.ai.discover(values);
		}

		console.log("\n%s:", prompt);

		for (const [index, card] of values.entries()) {
			console.log(card.readable(index + 1));
		}

		const choice = game.input();

		if (!values[game.lodash.parseInt(choice) - 1]) {
			/*
			 * Invalid input
			 * We still want the user to be able to select a card, so we force it to be valid
			 */
			return this.discover(
				prompt,
				actualCards,
				filterClassCards,
				amount,
				values,
			);
		}

		const card = values[game.lodash.parseInt(choice) - 1];

		return card;
	},
};
