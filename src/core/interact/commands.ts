import { Card, Player } from "@Game/internal.js";
import {
	Ability,
	type CommandList,
	Event,
	Keyword,
	type SelectTargetFlag,
	type Todo,
	Type,
	type UnknownEventValue,
} from "@Game/types.js";

/*
 * This is the list of commands that can be used in the game
 * This will be shown when using the 'help' command
 */
const helpBricks = [
	"end - Ends your turn",
	"attack - Attack",
	"hero power - Use your hero power",
	"history - Displays a history of actions",
	"concede - Forfeits the game",
	"view - View a minion",
	"use - Use a location card",
	"titan - Use a titan card",
	"detail - Get more details about opponent",
	"help - Displays this message",
	"version - Displays the version, branch, your settings preset, and some information about your current version.",
	"license - Opens a link to this project's license",
];

/*
 * This is the list of debug commands that can be used in the game
 * This will also be shown when using the 'help' command
 */
const helpDebugBricks = [
	"give (name) - Adds a card to your hand",
	"eval [log] (code) - Runs the code specified. If the word 'log' is before the code, instead console.log the code and wait for user input to continue. Examples: `/eval game.endGame(game.player)` (Win the game) `/eval @Player1.addToHand(@fe48ac1.perfectCopy())` (Adds a perfect copy of the card with uuid \"fe48ac1\" to player 1's hand) `/eval log h#c#1.attack + d#o#26.health + b#c#1.attack` (Logs the card in the current player's hand with index 1's attack value + the 26th card in the opponent's deck's health value + the card on the current player's side of the board with index 1's attack value)",
	"exit - Force exits the game. There will be no winner, and it will take you straight back to the hub.",
	"history - Displays a history of actions. This doesn't hide any information, and is the same thing the log files uses.",
	"rl - Reloads the cards and config in the game.",
	"frl - Does the same thing as rl, but doesn't wait for you to press enter before continuing.",
	"undo - Undoes the last card played. It gives the card back to your hand, and removes it from where it was. (This does not undo the actions of the card)",
	"ai - Gives you a list of the actions the ai(s) have taken in the order they took it",
];

const getGame = () => game;

export const commands: CommandList = {
	end(): boolean {
		game.endTurn();
		return true;
	},

	"hero power"(): boolean {
		if (game.player.ai) {
			game.player.heroPower();
			return true;
		}

		if (game.player.mana < (game.player.hero.heropower?.cost ?? 0)) {
			game.pause("<red>You do not have enough mana.</red>\n");
			return false;
		}

		if (game.player.hasUsedHeroPowerThisTurn) {
			game.pause(
				"<red>You have already used your hero power this turn.</red>\n",
			);
			return false;
		}

		if (game.player.disableHeroPower) {
			game.pause("<red>Your hero power is currently disabled.</red>\n");
			return false;
		}

		game.interact.info.showGame(game.player);
		const ask = game.interact.yesNoQuestion(
			`<yellow>${game.player.hero.heropower?.text}</yellow> Are you sure you want to use this hero power?`,
			game.player,
		);
		if (!ask) {
			return false;
		}

		game.interact.info.showGame(game.player);
		game.player.heroPower();
		return true;
	},

	attack(): boolean {
		game.interact.gameLoop.doTurnAttack();
		return true;
	},

	use(): boolean {
		// Use location
		const errorCode = game.interact.card.useLocation();

		if (errorCode === true || errorCode === "refund" || game.player.ai) {
			return true;
		}

		let error: string;

		switch (errorCode) {
			case "nolocations": {
				error = "You have no location cards";
				break;
			}

			case "invalidtype": {
				error = "That card is not a location card";
				break;
			}

			case "cooldown": {
				error = "That location is on cooldown";
				break;
			}

			default: {
				error = `An unknown error occourred. Error code: UnexpectedUseLocationResult@${errorCode}`;
				break;
			}
		}

		console.log("<red>%s.</red>", error);
		game.pause();
		return true;
	},

	titan(): boolean {
		// Use titan card
		const card = game.interact.selectCardTarget(
			"Which card do you want to use?",
			undefined,
			"friendly",
		);
		if (!card) {
			return false;
		}

		if (card.sleepy) {
			game.pause("<red>That card is exhausted.</red>\n");
			return false;
		}

		const titanIds = card.getKeyword(Keyword.Titan) as number[] | undefined;

		if (!titanIds) {
			game.pause("<red>That card is not a titan.</red>\n");
			return false;
		}

		const titanCards = titanIds.map((id) => new Card(id, game.player, true));

		game.interact.info.showGame(game.player);
		console.log(
			"\nWhich ability do you want to trigger?\n%s",
			titanCards.map((c) => c.readable).join(",\n"),
		);

		const choice = game.lodash.parseInt(game.input());

		if (
			!choice ||
			choice < 1 ||
			choice > titanCards.length ||
			Number.isNaN(choice)
		) {
			game.pause("<red>Invalid choice.</red>\n");
			return false;
		}

		const ability = titanCards[choice - 1];

		if (ability.activate(Ability.Cast) === -1) {
			game.functions.event.withSuppressed(Event.DiscardCard, () =>
				ability.discard(),
			);
			return false;
		}

		titanIds.splice(choice - 1, 1);

		card.setKeyword(Keyword.Titan, titanIds);

		if (titanIds.length <= 0) {
			card.remKeyword(Keyword.Titan);
		} else {
			card.sleepy = true;
		}

		game.event.broadcast(Event.Titan, [card, ability], game.player);
		return true;
	},

	help(): boolean {
		game.interact.info.watermark();
		console.log(
			"\n(In order to run a command; input the name of the command and follow further instruction.)\n",
		);
		console.log("Available commands:");

		const bricks = [
			logger.translate("(name) - (description)\n"),
			...helpBricks.map((brick) => logger.translate(brick)),
		];

		const wall = game.functions.util.createWall(bricks, "-");
		const debugWall = game.functions.util.createWall(helpDebugBricks, "-");

		// Normal commands
		for (const brick of wall) {
			console.log(brick);
		}

		const condColor = (text: string) =>
			game.config.general.debug ? text : `<gray>${text}</gray>`;
		const debugEnabled = game.config.general.debug
			? "<bright:green>ON</bright:green>"
			: "<red>OFF</red>";

		console.log(condColor(`\n--- Debug Commands (${debugEnabled}) ---`));

		// Debug Commands
		for (const brick of debugWall) {
			console.log(condColor(game.config.advanced.debugCommandPrefix + brick));
		}

		console.log(
			condColor(
				`---------------------------${game.config.general.debug ? "" : "-"}`,
			),
		);

		game.pause("\nPress enter to continue...\n");
		return true;
	},

	view(): boolean {
		const isHandAnswer = game.interact.question(
			game.player,
			"Do you want to view a minion on the board, or in your hand?",
			["Board", "Hand"],
		);
		const isHand = isHandAnswer === "Hand";

		if (!isHand) {
			// AllowLocations Makes selecting location cards allowed. This is disabled by default to prevent, for example, spells from killing the card.
			const card = game.interact.selectCardTarget(
				"Which minion do you want to view?",
				undefined,
				"any",
				["allowLocations"],
			);
			if (!card) {
				return false;
			}

			card.view();

			return true;
		}

		// View minion on the board
		const cardIndex = game.input("\nWhich card do you want to view? ");
		if (!cardIndex || !game.lodash.parseInt(cardIndex)) {
			return false;
		}

		const card = game.player.hand[game.lodash.parseInt(cardIndex) - 1];

		card.view();
		return true;
	},

	detail(): boolean {
		game.player.detailedView = !game.player.detailedView;
		return true;
	},

	concede(): boolean {
		game.interact.info.showGame(game.player);
		const confirmation = game.interact.yesNoQuestion(
			"Are you sure you want to concede?",
			game.player,
		);
		if (!confirmation) {
			return false;
		}

		game.endGame(game.player.getOpponent());
		return true;
	},

	license(): boolean {
		game.functions.util.openInBrowser(
			`${game.config.info.githubUrl}/blob/main/LICENSE`,
		);
		return true;
	},

	version(): boolean {
		const { version, branch, build } = game.functions.info.version();

		let running = true;
		while (running) {
			const todos = Object.entries(game.config.todo);

			const printInfo = () => {
				const game = getGame();
				game.interact.info.showGame(game.player);

				let strbuilder = `\nYou are on version: ${version}, on `;

				switch (branch) {
					case "topic": {
						strbuilder += "a topic branch";

						break;
					}

					case "alpha": {
						strbuilder += "the alpha branch";

						break;
					}

					case "beta": {
						strbuilder += "the beta branch";

						break;
					}

					case "stable": {
						strbuilder += "the stable (release) branch";

						break;
					}

					// No default
				}

				strbuilder += `, on build ${build}`;
				strbuilder += `, with latest commit hash '${game.functions.info.latestCommit()}',`;

				if (game.config.general.debug && game.config.ai.player2) {
					strbuilder += " using the debug settings preset";
				} else if (!game.config.general.debug && !game.config.ai.player2) {
					strbuilder += " using the recommended settings preset";
				} else {
					strbuilder += " using custom settings";
				}

				console.log(`${strbuilder}.\n`);

				console.log("Version Description:");

				let introText: string;

				switch (branch) {
					case "topic": {
						introText = game.config.info.topicIntroText;

						break;
					}

					case "alpha": {
						introText = game.config.info.alphaIntroText;

						break;
					}

					case "beta": {
						introText = game.config.info.betaIntroText;

						break;
					}

					case "stable": {
						introText = game.config.info.stableIntroText;

						break;
					}

					default: {
						throw new Error(`Invalid branch: ${branch}`);
					}
				}

				console.log(introText);
				if (game.config.info.versionText) {
					console.log(game.config.info.versionText);
				}

				console.log();

				console.log("Todo List:");
				if (todos.length <= 0) {
					console.log("None.");
				}
			};

			printInfo();

			// This is the todo list
			if (todos.length <= 0) {
				game.pause("\nPress enter to continue...");
				running = false;
				break;
			}

			const printTodo = (
				todo: [string, Todo],
				id: number,
				printDesc = false,
			) => {
				let [name, info] = todo;

				name = name.replaceAll("_", " ");
				let state: string;

				switch (info.state) {
					case "done": {
						state = "x";

						break;
					}

					case "doing": {
						state = "o";

						break;
					}

					case "not done": {
						state = " ";

						break;
					}

					case "first pass":
					case "second pass":
					case "third pass": {
						state = info.state;

						break;
					}

					// No default
				}

				if (printDesc) {
					console.log("{%s} [%s] %s\n%s", id, state, name, info.description);
				} else {
					console.log("{%s} [%s] %s", id, state, name);
				}
			};

			for (const [index, todo] of todos.entries()) {
				printTodo(todo, index + 1);
			}

			const todoIndex = game.lodash.parseInt(
				game.input(
					"\nType the id of a todo to see more information about it (eg. 1): ",
				),
			);
			if (!todoIndex || todoIndex > todos.length || todoIndex <= 0) {
				running = false;
				break;
			}

			const todo = todos[todoIndex - 1];

			printInfo();
			printTodo(todo, todoIndex, true);

			const command = game.input(
				'\nType "issue" to open the todo in your webbrowser.\n',
			);
			if (command === "issue") {
				const link = `${game.config.info.githubUrl}/issues/${todo[1].issue}`;
				game.functions.util.openInBrowser(link);
			}
		}

		return true;
	},

	history(_, flags): string {
		// History
		const { history } = game.event;
		let finished = "";

		const showCard = (value: Card) =>
			`${value.readable()} which belongs to: <blue>${value.owner.name}</blue>, and has uuid: ${value.coloredUUID()}`;

		/**
		 * Transform the `value` into a readable string
		 *
		 * @param hide If it should hide the card
		 */
		const doValue = (
			value: unknown,
			player: Player,
			hide: boolean,
		): unknown => {
			if (value instanceof Player) {
				return `Player ${value.id + 1}`;
			}

			if (!(value instanceof Card)) {
				// Return value as-is if it is not a card / player
				return value;
			}

			// If the card is not hidden, or the card belongs to the current player, show it
			if (!hide || value.owner === player) {
				return showCard(value);
			}

			// Hide the card
			let revealed = false;

			// It has has been revealed, show it.
			for (const historyValue of Object.values(history)) {
				if (revealed) {
					continue;
				}

				for (const historyKey of historyValue) {
					if (revealed) {
						continue;
					}

					const [key, newValue] = historyKey;

					// This shouldn't happen?
					if (!newValue) {
						continue;
					}

					if (game.config.advanced.whitelistedHistoryKeys.includes(key)) {
						// Do nothing
					} else {
						continue;
					}

					if (game.config.advanced.hideValueHistoryKeys.includes(key)) {
						continue;
					}

					// If it is not a card
					if (!(newValue instanceof Card)) {
						continue;
					}

					if (value.uuid !== newValue.uuid) {
						continue;
					}

					// The card has been revealed.
					revealed = true;
				}
			}

			if (revealed) {
				return `Hidden > Revealed as: ${showCard(value)}`;
			}

			return "Hidden";
		};

		for (const [historyListIndex, historyList] of Object.values(
			history,
		).entries()) {
			let hasPrintedHeader = false;
			let previousPlayer: Player | undefined;

			for (const [historyIndex, historyKey] of historyList.entries()) {
				let [key, value, player] = historyKey;
				if (!player) {
					// TODO: Maybe throw an error
					continue;
				}

				if (player !== previousPlayer) {
					hasPrintedHeader = false;
				}

				previousPlayer = player;

				if (
					game.config.advanced.whitelistedHistoryKeys.includes(key) ||
					flags?.debug
				) {
					// Pass
				} else {
					continue;
				}

				/*
				 * If the `key` is "AddCardToHand", check if the previous history entry was `DrawCard`, and they both contained the exact same `val`.
				 * If so, ignore it.
				 */
				if (key === Event.AddCardToHand && historyIndex > 0) {
					const lastEntry = history[historyListIndex][historyIndex - 1];

					if (
						lastEntry[0] === Event.DrawCard &&
						(lastEntry[1] as Card).uuid === (value as Card).uuid
					) {
						continue;
					}
				}

				const shouldHide =
					game.config.advanced.hideValueHistoryKeys.includes(key) &&
					!flags?.debug;

				if (!hasPrintedHeader) {
					finished += `\nTurn ${historyListIndex} - Player [${player.name}]\n`;
				}

				hasPrintedHeader = true;

				value = doValue(value, game.player, shouldHide) as UnknownEventValue;

				if (Array.isArray(value)) {
					let strbuilder = "";

					for (let v of value) {
						v = doValue(v, game.player, shouldHide) as
							| string
							| number
							| Player
							| Card
							| SelectTargetFlag[]
							| undefined;
						strbuilder += `${v?.toString()}, `;
					}

					strbuilder = strbuilder.slice(0, -2);
					value = strbuilder;
				}

				const finishedKey = key[0].toUpperCase() + key.slice(1);

				finished += `${finishedKey}: ${value?.toString()}\n`;
			}
		}

		if (flags?.echo === false) {
			// Do nothing
		} else {
			console.log(finished);

			game.pause("\nPress enter to continue...");
		}

		return finished;
	},
};

export const debugCommands: CommandList = {
	give(args): boolean {
		if (args.length <= 0) {
			game.pause("<red>Too few arguments.</red>\n");
			return false;
		}

		const cardName = args.join(" ");

		// TODO: Get all cards from the name and ask the user which one they want
		const card = Card.fromName(cardName, game.player);
		if (!card) {
			game.pause(`<red>Invalid card: <yellow>${cardName}</yellow>.\n`);
			return false;
		}

		game.player.addToHand(card);
		return true;
	},

	exit(): boolean {
		game.running = false;
		return true;
	},

	eval(args): boolean {
		if (args.length <= 0) {
			game.pause("<red>Too few arguments.</red>\n");
			return false;
		}

		const code = game.interact.parseEvalArgs(args);
		console.log(`Running: ${code}\n`);

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

	rl(_, flags): boolean {
		let success = true;

		success &&= game.interact.info.withStatus("Reloading cards", () =>
			Card.reloadAll(),
		);

		// Go through all the cards and reload them
		success &&= game.interact.info.withStatus(
			"Applying changes to existing cards",
			() => {
				// Hand and decks of the players
				for (const player of [game.player1, game.player2]) {
					for (const card of player.hand) {
						card.reload();
					}

					for (const card of player.deck) {
						card.reload();
					}

					for (const card of player.board) {
						card.reload();
					}

					for (const card of player.graveyard) {
						card.reload();
					}
				}

				return true;
			},
		);

		success &&= game.interact.info.withStatus("Reloading config", () =>
			game.functions.util.importConfig(),
		);
		success &&= game.interact.info.withStatus("Reloading language map", () =>
			Boolean(game.functions.util.getLanguageMap(true)),
		);

		if (success) {
			if (flags?.debug) {
				return true;
			}

			game.pause("\nThe cards have been reloaded.\nPress enter to continue...");
			return true;
		}

		game.pause(
			"\nSome steps failed. The game could not be fully reloaded. Please report this.\nPress enter to continue...",
		);
		return false;
	},

	undo(): boolean {
		// Get the last played card
		if (
			!game.event.events.PlayCard ||
			game.event.events.PlayCard[game.player.id].length <= 0
		) {
			game.pause("<red>No cards to undo.</red>\n");
			return false;
		}

		const eventCards: Array<[Card, number]> =
			game.event.events.PlayCard[game.player.id];
		if (eventCards.length <= 0) {
			game.pause("<red>No cards to undo.</red>\n");
			return false;
		}

		let card = game.lodash.last(eventCards)?.[0];
		if (!card) {
			game.pause("<red>No cards found.</red>\n");
			return false;
		}

		// Remove the event so you can undo more than the last played card
		game.event.events.PlayCard[game.player.id].pop();

		// If the card can appear on the board, remove it.
		if (card.canBeOnBoard()) {
			game.functions.util.remove(game.player.board, card);

			// If the card has 0 or less health, restore it to its original health (according to the blueprint)
			if (card.type === Type.Minion && !card.isAlive()) {
				card.health = card.storage.init.health;
			} else if (card.type === Type.Location && (card.durability ?? 0) <= 0) {
				if (!card.durability) {
					throw new Error("Location has undefined durability!");
				}

				card.durability = card.storage.init.durability;
			}
		}

		card = card.perfectCopy();

		// If the card is a weapon, destroy it before adding it to the player's hand.
		if (card.type === Type.Weapon) {
			game.player.destroyWeapon();
		}

		// If the card is a hero, reset the player's hero to the default one from their class.
		if (card.type === Type.Hero) {
			game.player.setToStartingHero();
		}

		game.player.addToHand(card);
		game.player.refreshMana(card.cost);
		return true;
	},

	ai(_, flags): string {
		let finished = "";

		if (flags?.echo) {
			finished += "AI Info:\n\n";
		}

		for (let i = 0; i < 2; i++) {
			const player = Player.fromID(i);
			if (!player.ai) {
				continue;
			}

			finished += `AI${i + 1} History: {\n`;

			for (const [objectIndex, object] of player.ai.history.entries()) {
				finished += `${objectIndex + 1} ${object.type}: (${object.data}),\n`;
			}

			finished += "}\n";
		}

		if (flags?.echo === false) {
			// Do nothing
		} else {
			console.log(finished);

			game.pause("\nPress enter to continue...");
		}

		return finished;
	},

	history(): string {
		return game.interact.gameLoop.handleCmds("history", {
			debug: true,
		}) as string;
	},

	frl(): string {
		return game.interact.gameLoop.handleCmds(
			`${game.config.advanced.debugCommandPrefix}rl`,
			{ debug: true },
		) as string;
	},
};
