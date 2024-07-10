/**
 * Tests that cards works properly. Executes the `test` ability on all cards in its own env.
 *
 * @module Test Cards
 */

import process from "node:process";
import { Card, type Player, createGame } from "@Game/internal.js";
import { Ability } from "@Game/types.js";

const { game } = createGame();
const cards = Card.all(true);

/**
 * Tests that a card works properly by triggering the `test` ability.
 *
 * @param card The card to test
 *
 * @returns Success | Error
 */
function testCard(card: Card): boolean | Error {
	try {
		card.activate(Ability.Test);
	} catch (error) {
		if (error instanceof Error) {
			return error;
		}
	}

	return true;
}

// Assign decks
const assignDeck = (player: Player) => {
	const deck = game.functions.deckcode.import(player, "Mage /30/ 1");
	if (!deck || deck.length <= 0) {
		throw new Error("Invalid deckcode");
	}

	player.deck = deck;
};

/**
 * Executes a series of tests on the cards in the 'cards' array.
 */
export function main(): void {
	for (const [index, blueprint] of cards.entries()) {
		process.stderr.write(
			`\r\u001B[KTesting card ${index + 1} / ${cards.length}...`,
		);

		// Create a game
		const { game, player1, player2 } = createGame();
		game.config.ai.player1 = false;
		game.config.ai.player2 = false;
		game.doConfigAi();

		game.setup(player1, player2);
		game.player = player1;
		game.opponent = player2;

		game.config.decks.validate = false;
		assignDeck(player1);
		assignDeck(player2);

		game.startGame();

		const card = blueprint.imperfectCopy();
		card.owner = player1;

		game.noOutput = true;
		const error = testCard(card);
		game.noOutput = false;

		if (error instanceof Error) {
			console.error(
				`<red>ERROR: ${card.name} (${card.id}) didn't pass its test. Here is the error. THIS ERROR IS PART OF THE SCRIPT, NOT AN ACTUAL ERROR.</red>`,
			);
			console.error(error.stack);
			console.error();
			process.exitCode = 1;
		}
	}

	if (process.exitCode !== 1) {
		console.log("\n<bright:green>All tests passed!</bright:green>");
	}

	console.log();
}

main();
