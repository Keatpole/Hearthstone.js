/**
 * Interact stuff.
 * @module Interact
 */
import process from "node:process";
import {
	Card,
	type Player,
	cardInteract,
	gameloopInteract,
	infoInteract,
} from "@Game/internal.js";
import {
	Event,
	Keyword,
	type SelectTargetAlignment,
	type SelectTargetClass,
	type SelectTargetFlag,
	type Target,
	Type,
} from "@Game/types.js";

export const interact = {
	/**
	 * Card related interactions.
	 */
	card: cardInteract,

	/**
	 * Information.
	 */
	info: infoInteract,

	/**
	 * Game loop related interactions.
	 */
	gameLoop: gameloopInteract,

	// Deck stuff

	/**
	 * Asks the player to supply a deck code.
	 *
	 * If no code was given, fill the players deck with 30 Sheep unless both;
	 * - Debug mode is disabled
	 * - The program is running on the stable branch
	 *
	 * @param player The player to ask
	 *
	 * @returns Success
	 */
	deckCode(player: Player): boolean {
		game.interact.info.watermark();
		console.log();

		const { branch } = game.functions.info.version();

		/**
		 * If the test deck (30 Sheep) should be allowed
		 */
		// I want to be able to test without debug mode on a non-stable branch
		const allowTestDeck: boolean =
			game.config.general.debug || branch !== "stable";

		const debugStatement = allowTestDeck
			? " <gray>(Leave this empty for a test deck)</gray>"
			: "";
		const deckcode = logger.inputTranslate(
			"Player %s, please type in your deckcode%s: ",
			player.id + 1,
			debugStatement,
		);

		let result = true;

		if (deckcode.length > 0) {
			logger.debug(`${player.name} chose deck code: ${deckcode}...`);
			result = Boolean(game.functions.deckcode.import(player, deckcode));

			if (result) {
				logger.debug(`${player.name} chose deck code: ${deckcode}...OK`);
			} else {
				logger.debug(`${player.name} chose deck code: ${deckcode}...FAIL`);
			}
		} else {
			if (!allowTestDeck) {
				// Give error message
				game.pause("<red>Please enter a deckcode!</red>\n");
				return false;
			}

			logger.debug(`${player.name} chose debug deck...`);

			// Debug mode is enabled, use the 30 Sheep debug deck.
			while (player.deck.length < 30) {
				player.deck.push(new Card(game.cardIds.sheep1, player, true));
			}

			logger.debug(`${player.name} chose debug deck...OK`);
		}

		return result;
	},

	// One-time things

	/**
	 * Asks the player to choose an option.
	 *
	 * @param times The amount of times to ask
	 * @param prompts [prompt, callback]
	 */
	chooseOne(times: number, ...prompts: Array<[string, () => void]>): void {
		let chosen = 0;

		while (chosen < times) {
			game.interact.info.showGame(game.player);

			if (game.player.ai) {
				const aiChoice = game.player.ai.chooseOne(prompts.map((p) => p[0]));
				if (aiChoice === undefined) {
					continue;
				}

				chosen++;

				// Call the callback function
				prompts[aiChoice][1]();
				continue;
			}

			let p = `\nChoose ${times - chosen}:\n`;

			for (const [index, promptObject] of prompts.entries()) {
				p += `${index + 1}: ${promptObject[0]},\n`;
			}

			const choice = game.lodash.parseInt(game.input(p)) - 1;
			if (Number.isNaN(choice) || choice < 0 || choice >= prompts.length) {
				game.pause("<red>Invalid input!</red>\n");
				this.chooseOne(times, ...prompts);
				return;
			}

			chosen++;

			// Call the callback function
			prompts[choice][1]();
		}
	},

	/**
	 * Asks the `player` a `prompt`, show them a list of `answers` and make them choose one
	 *
	 * @param player The player to ask
	 * @param prompt The prompt to show
	 * @param answers The answers to choose from
	 *
	 * @returns Chosen
	 */
	question(player: Player, prompt: string, answers: string[]): string {
		const retry = () => this.question(player, prompt, answers);

		game.interact.info.showGame(player);

		let strbuilder = `\n${prompt} [`;

		for (const [index, answer] of answers.entries()) {
			strbuilder += `${index + 1}: ${answer}, `;
		}

		strbuilder = strbuilder.slice(0, -2);
		strbuilder += "] ";

		let choice: number;

		if (player.ai) {
			const aiChoice = player.ai.question(prompt, answers);
			if (!aiChoice) {
				// Code, expected, actual
				throw new Error(
					`AI Error: expected: ${aiChoice}, got: some number. Error Code: AiQuestionReturnInvalidAtQuestionFunction`,
				);
			}

			choice = aiChoice;
		} else {
			choice = game.lodash.parseInt(game.input(strbuilder));
		}

		const answer = answers[choice - 1];
		if (!answer) {
			game.pause("<red>Invalid input!</red>\n");
			retry();
		}

		return answer;
	},

	/**
	 * Asks the user a yes/no question
	 *
	 * @param prompt The prompt to ask
	 * @param player Used to check if the player is an ai
	 *
	 * @returns `true` if Yes / `false` if No
	 */
	yesNoQuestion(prompt: string, player?: Player): boolean {
		const ask = `\n${prompt} [<bright:green>Y</bright:green> | <red>N</red>] `;

		if (player?.ai) {
			return player.ai.yesNoQuestion(prompt);
		}

		const rawChoice = game.input(ask);
		const choice = rawChoice.toUpperCase()[0];

		if (["Y", "N"].includes(choice)) {
			return choice === "Y";
		}

		// Invalid input
		console.log(
			"<red>Unexpected input: '<yellow>%s</yellow>'. Valid inputs: </red>[<bright:green>Y</bright:green> | <red>N</red>]",
			rawChoice,
		);
		game.pause();

		return this.yesNoQuestion(prompt, player);
	},

	/**
	 * Like `selectTarget` but restricts the user to selecting heroes.
	 *
	 * The advantage of this function is that it returns `Player | false` instead of `Target | false`.
	 */
	selectPlayerTarget(
		prompt: string,
		card: Card | undefined,
		flags: SelectTargetFlag[] = [],
	): Player | false {
		return this.selectTarget(prompt, card, "any", "hero", flags) as
			| Player
			| false;
	},

	/**
	 * Like `selectTarget` but restricts the user to selecting minions.
	 *
	 * The advantage of this function is that it returns `Card | false` instead of `Target | false`.
	 */
	selectCardTarget(
		prompt: string,
		card: Card | undefined,
		side: SelectTargetAlignment,
		flags: SelectTargetFlag[] = [],
	): Card | false {
		return this.selectTarget(prompt, card, side, "minion", flags) as
			| Card
			| false;
	},

	/**
	 * #### You might want to use `selectPlayerTarget` or `selectCardTarget` instead.
	 *
	 * Asks the user a `prompt`, the user can then select a minion or hero.
	 * Broadcasts the `TargetSelectionStarts` and the `TargetSelected` event.
	 *
	 * @param prompt The prompt to ask
	 * @param card The card that called this function.
	 * @param forceSide Force the user to only be able to select minions / the hero of a specific side
	 * @param forceClass Force the user to only be able to select a minion or a hero
	 * @param flags Change small behaviours ["allowLocations" => Allow selecting location, ]
	 *
	 * @returns The card or hero chosen
	 */
	selectTarget(
		prompt: string,
		card: Card | undefined,
		forceSide: SelectTargetAlignment,
		forceClass: SelectTargetClass,
		flags: SelectTargetFlag[] = [],
	): Target | false {
		game.event.broadcast(
			Event.TargetSelectionStarts,
			[prompt, card, forceSide, forceClass, flags],
			game.player,
		);
		const target = this._selectTarget(
			prompt,
			card,
			forceSide,
			forceClass,
			flags,
		);

		if (target) {
			game.event.broadcast(Event.TargetSelected, [card, target], game.player);
		}

		return target;
	},

	/**
	 * # USE `selectTarget` INSTEAD.
	 */
	_selectTarget(
		prompt: string,
		card: Card | undefined,
		forceSide: SelectTargetAlignment,
		forceClass: SelectTargetClass,
		flags: SelectTargetFlag[] = [],
	): Target | false {
		// If the player is forced to select a target, select that target.
		if (game.player.forceTarget) {
			return game.player.forceTarget;
		}

		// Add spell damage in prompt
		const spellDamageRegex = /\$(\d+)/g;
		const matches = spellDamageRegex.exec(prompt);
		matches?.splice(0, 1);

		let newPrompt = prompt;

		if (matches) {
			for (const match of matches) {
				newPrompt = prompt.replace(
					match,
					(game.lodash.parseInt(match) + game.player.spellDamage).toString(),
				);
			}
		}

		newPrompt = prompt.replaceAll(spellDamageRegex, "$1");

		// If the player is an ai, hand over control to the ai.
		if (game.player.ai) {
			return game.player.ai.selectTarget(
				newPrompt,
				card,
				forceSide,
				forceClass,
				flags,
			);
		}

		// If the player is forced to select a hero
		if (forceClass === "hero") {
			// You shouldn't really force a side while forcing a hero, but it should still work
			if (forceSide === "enemy") {
				return game.opponent;
			}

			if (forceSide === "friendly") {
				return game.player;
			}

			const target = game.input(
				"Do you want to select the enemy hero, or your own hero? (y: enemy, n: friendly) ",
			);

			return target.startsWith("y") ? game.opponent : game.player;
		}

		/*
		 * From this point, forceClass is either
		 * 1. any
		 * 2. minion
		 */

		// Ask the player to choose a target.
		let p = `\n${newPrompt} (`;
		if (forceClass === "any") {
			let possibleHeroes = forceSide === "enemy" ? "the enemy" : "your";
			possibleHeroes = forceSide === "any" ? "a" : possibleHeroes;

			p += `type 'face' to select ${possibleHeroes} hero | `;
		}

		p += "type 'back' to go back) ";

		const target = game.input(p);

		// Player chose to go back
		if (target.startsWith("b") || this.shouldExit(target)) {
			// This should always be safe.
			return false;
		}

		// If the player chose to target a hero, it will ask which hero.
		if (target.startsWith("face") && forceClass !== "minion") {
			return this._selectTarget(newPrompt, card, forceSide, "hero", flags);
		}

		// From this point, the player has chosen a minion.

		// Get a list of each side of the board
		const boardOpponent = game.opponent.board;
		const boardFriendly = game.player.board;

		// Get each minion that matches the target.
		const boardOpponentTarget = boardOpponent[game.lodash.parseInt(target) - 1];
		const boardFriendlyTarget = boardFriendly[game.lodash.parseInt(target) - 1];

		/**
		 * This is the resulting minion that the player chose, if any.
		 */
		let minion: Card;

		// If the player didn't choose to attack a hero, and no minions could be found at the index requested, try again.
		if (!boardFriendlyTarget && !boardOpponentTarget) {
			game.pause("<red>Invalid input / minion!</red>\n");

			// Try again
			return this._selectTarget(newPrompt, card, forceSide, forceClass, flags);
		}

		if (forceSide === "any") {
			/*
			 * If both players have a minion with the same index,
			 * ask them which minion to select
			 */
			if (
				boardOpponent.length >= game.lodash.parseInt(target) &&
				boardFriendly.length >= game.lodash.parseInt(target)
			) {
				const opponentTargetName = boardOpponentTarget.colorFromRarity();
				const friendlyTargetName = boardFriendlyTarget.colorFromRarity();

				const alignment = logger.inputTranslate(
					"Do you want to select your opponent's (%s) or your own (%s)? (y: opponent, n: friendly | type 'back' to go back) ",
					opponentTargetName,
					friendlyTargetName,
				);

				if (alignment.startsWith("b") || this.shouldExit(alignment)) {
					// Go back.
					return this._selectTarget(
						newPrompt,
						card,
						forceSide,
						forceClass,
						flags,
					);
				}

				minion = alignment.startsWith("y")
					? boardOpponentTarget
					: boardFriendlyTarget;
			} else {
				// If there is only one minion, select it.
				minion =
					boardOpponent.length >= game.lodash.parseInt(target)
						? boardOpponentTarget
						: boardFriendlyTarget;
			}
		} else {
			/*
			 * If the player is forced to one side.
			 * Select the minion on the correct side of the board.
			 */
			minion =
				forceSide === "enemy" ? boardOpponentTarget : boardFriendlyTarget;
		}

		// If you didn't select a valid minion, return.
		if (minion === undefined) {
			game.pause("<red>Invalid minion.</red>\n");
			return false;
		}

		// If the minion has elusive, and the card that called this function is a spell
		if (
			(card?.type === Type.Spell ||
				card?.type === Type.HeroPower ||
				flags.includes("forceElusive")) &&
			minion.hasKeyword(Keyword.Elusive)
		) {
			game.pause("<red>Can't be targeted by Spells or Hero Powers.</red>\n");
			return false;
		}

		// If the minion has stealth, don't allow the opponent to target it.
		if (minion.hasKeyword(Keyword.Stealth) && game.player !== minion.owner) {
			game.pause("<red>This minion has stealth.</red>\n");

			return false;
		}

		// If the minion is a location, don't allow it to be selected unless the `allowLocations` flag was set.
		if (minion.type === Type.Location && !flags.includes("allowLocations")) {
			game.pause("<red>You cannot target location cards.</red>\n");

			return false;
		}

		return minion;
	},

	/**
	 * Returns if the input is a command to exit / go back.
	 */
	shouldExit(input: string): boolean {
		return ["exit", "stop", "quit", "back", "close"].includes(
			input.toLowerCase(),
		);
	},

	/**
	 * Verifies that the diy card has been solved.
	 *
	 * @param condition The condition where, if true, congratulates the user
	 * @param card The DIY card itself
	 *
	 * @returns Success
	 */
	verifyDiySolution(condition: boolean, card: Card): boolean {
		if (card.owner.ai) {
			return false;
		}

		let success = false;

		if (condition) {
			console.log("Success! You did it, well done!");
			success = true;
		} else {
			const match = /DIY (\d+)/.exec(card.name);
			const fileName = match ? match[1] : "unknown";

			console.log(
				"Hm. This card doesn't seem to do what it's supposed to do... Maybe you should try to fix it? The card is in: './cards/Examples/DIY/%s.ts'.",
				fileName,
			);
		}

		game.pause();
		return success;
	},

	/**
	 * Parses the given arguments for the eval command and returns the code to evaluate
	 */
	parseEvalArgs(args: string[]): string {
		if (args.length <= 0) {
			game.pause("<red>Too few arguments.</red>\n");
			return args.join(" ");
		}

		let log = false;

		if (args[0] === "log") {
			log = true;
			args.shift();
		}

		let code = args.join(" ");

		// Allow for stuff like `/eval @Player1.addToHand(@00ff00.perfectCopy());`
		code = code.replaceAll("@Player", "game.player");

		let trueLog = false;

		const uuidRegex = /@\w+/g;
		for (const match of code.matchAll(uuidRegex)) {
			const uuid = match[0].slice(1);

			// HACK: Do this or logging doesn't work.
			if (log) {
				code = code.replace(
					`@${uuid}`,
					`let __card = Card.fromUUID("${uuid}");if (!__card) throw new Error("Card with uuid \\"${uuid}\\" not found");console.log(__card`,
				);

				log = false;
				trueLog = true;
			} else {
				code = code.replace(
					`@${uuid}`,
					`let __card = Card.fromUUID("${uuid}");if (!__card) throw new Error("Card with uuid \\"${uuid}\\" not found");__card`,
				);
			}
		}

		/*
		 * Allow for stuff like `/eval h#c#1.addAttack(b#o#2.attack)`;
		 * ^^ This adds the second card on the opponent's side of the board's attack to the card at index 1 in the current player's hand
		 */
		const indexBasedRegex = /([hbdg])#([co])#(\d+)/g;
		for (const match of code.matchAll(indexBasedRegex)) {
			let [line, where, side, index] = match;

			switch (where) {
				case "h": {
					where = "game.player[x].hand";
					break;
				}

				case "d": {
					where = "game.player[x].deck";
					break;
				}

				case "b": {
					where = "game.player[x].board";
					break;
				}

				case "g": {
					where = "game.player[x].graveyard";
					break;
				}

				// No default
			}

			side =
				side === "c"
					? (game.player.id + 1).toString()
					: (game.opponent.id + 1).toString();
			where = where.replaceAll("[x]", side);

			code = code.replace(line, `${where}[${index} - 1]`);
		}

		if (log) {
			if (code.at(-1) === ";") {
				code = code.slice(0, -1);
			}

			code = `console.log(${code});game.pause();`;
		}

		if (trueLog) {
			if (code.at(-1) === ";") {
				code = code.slice(0, -1);
			}

			code = `${code});game.pause();`;
		}

		return code;
	},

	/**
	 * Clears the screen.
	 */
	cls(): void {
		if (game?.noOutput) {
			return;
		}

		console.clear();
		process.stdout.write("\u001Bc");
	},
};
