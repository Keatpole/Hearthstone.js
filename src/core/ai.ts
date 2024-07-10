/**
 * The AI
 * @module AI
 */
import { Card, Player } from "@Game/internal.js";
import {
	type AiCalcMoveOption,
	type AiHistory,
	Keyword,
	type ScoredCard,
	type SelectTargetAlignment,
	type SelectTargetClass,
	type SelectTargetFlag,
	type Target,
	Type,
} from "@Game/types.js";

// TODO: Ai gets stuck in infinite loop when using cathedral of atonement (location) | shadowcloth needle (0 attack wpn) | that minion has no attack.

/**
 * The AI class.
 */
export class Ai {
	/**
	 * The history of the AI. Also known as its "logs".
	 */
	history: AiHistory[] = [];

	/**
	 * Prevent the ai from doing the actions that are in this array
	 */
	prevent: string[] = [];

	/**
	 * The cards that the AI has played this turn
	 */
	cardsPlayedThisTurn: Card[] = [];

	/**
	 * The locations that the AI has used this turn
	 */
	usedLocationsThisTurn: Card[] = [];

	/**
	 * The card that the AI has focused, and is trying to kill
	 */
	focus: Card | undefined;

	/**
	 * Sentiment-based AI
	 */
	constructor(private readonly player: Player) {
		this.player = player;
	}

	/**
	 * Calculate the best move and return the result.
	 *
	 * This can return: A card to play, "hero power", "attack", "use" or "end"
	 *
	 * @returns Result
	 */
	calcMove(): AiCalcMoveOption {
		let bestMove: AiCalcMoveOption | undefined;
		let bestScore = -100_000;

		// Look for highest score
		for (const card of this.player.hand) {
			const score = this.analyzePositiveCard(card);

			if (
				score <= bestScore ||
				card.cost > this.player.mana ||
				this.cardsPlayedThisTurn.includes(card)
			) {
				continue;
			}

			// If the card is a minion and the player doesn't have the board space to play it, ignore the card
			if (
				card.canBeOnBoard() &&
				this.player.board.length >= game.config.general.maxBoardSpace
			) {
				continue;
			}

			// Prevent the ai from playing the same card they returned from when selecting a target
			let prevent = false;

			for (const [index, historyEntry] of this.history.entries()) {
				if (
					Array.isArray(historyEntry.data) &&
					historyEntry.data[1] === "0,1" &&
					this.history[index - 1].data[0] === card.uuid
				) {
					prevent = true;
				}
			}

			if (prevent) {
				continue;
			}

			bestMove = card;
			bestScore = score;
		}

		// If a card wasn't chosen
		if (!bestMove) {
			if (this._canHeroPower()) {
				bestMove = "hero power";
			} else if (this._canAttack()) {
				bestMove = "attack";
			} else if (this._canUseLocation()) {
				bestMove = "use";
			} else {
				bestMove = "end";
			}

			this.history.push({ type: "calcMove", data: bestMove });
		} else if (bestMove instanceof Card) {
			this.history.push({ type: "calcMove", data: [bestMove.uuid, bestScore] });

			this.cardsPlayedThisTurn.push(bestMove);
		}

		if (bestMove === "end") {
			for (const [index, historyEntry] of this.history.entries()) {
				if (
					Array.isArray(historyEntry) &&
					historyEntry[0] === "selectTarget" &&
					historyEntry[1] === "0,1"
				) {
					this.history[index].data = null;
				}
			}

			this.cardsPlayedThisTurn = [];
			this.usedLocationsThisTurn = [];
			this.prevent = [];
		}

		return bestMove;
	}

	/**
	 * Makes the ai attack
	 *
	 * @returns Attacker, Target
	 */
	attack(): Array<Target | -1> {
		// Assign a score to all minions
		const board: ScoredCard[][] = [game.player1.board, game.player2.board].map(
			(m) => m.map((c) => ({ card: c, score: this.analyzePositiveCard(c) })),
		);

		const amountOfTrades = this._attackFindTrades()
			.map((t) => t.length)
			.reduce((a, b) => a + b);

		// The ai should skip the trade stage if in risk mode
		const currentWinner = this._findWinner(board);
		const opponentScore = this._scorePlayer(this.player.getOpponent(), board);

		// If the ai is winner by more than 'threshold' points, enable risk mode
		const riskMode =
			currentWinner[1] >= opponentScore + game.config.ai.riskThreshold;

		const taunts = this._findTaunts();

		// If there is a taunt, attack it before trading
		if (taunts.length > 0) {
			return this._attackGeneral(board);
		}

		if (amountOfTrades > 0 && !riskMode) {
			return this._attackTrade() ?? [-1, -1];
		}

		return this._attackGeneral(board);
	}

	/**
	 * Makes the ai attack.
	 * This gets called if you set the ai attack model to 1.
	 *
	 * @deprecated Use `AI.attack` instead.
	 *
	 * @returns Attacker, Target
	 */
	legacyAttack1(): Array<Target | undefined> {
		let worstMinion: Card | undefined;
		let worstScore = 100_000;

		for (const minion of this.player.board.filter((m) => m.canAttack())) {
			const score = this.analyzePositiveCard(minion);

			if (score >= worstScore) {
				continue;
			}

			worstMinion = minion;
			worstScore = score;
		}

		if (!worstMinion) {
			this.history.push({ type: "attack, [null, null]", data: [-1, -1] });
			this.prevent.push("attack");
			return [undefined, undefined];
		}

		let attacker: Target = worstMinion;

		let bestMinion: Card | undefined;
		let bestScore = -100_000;

		// Check if there is a minion with taunt
		const taunts = this._findTaunts();
		const targets =
			taunts.length > 0 ? taunts : this.player.getOpponent().board;

		for (const target of targets.filter((target) => target.canBeAttacked())) {
			const score = this.analyzePositiveCard(target);

			if (score <= bestScore) {
				continue;
			}

			bestMinion = target;
			bestScore = score;
		}

		let target: Target | undefined = bestMinion;

		// If the AI has no minions to attack, attack the enemy hero
		if (!target) {
			if (
				taunts.length === 0 &&
				attacker &&
				((attacker as Target) instanceof Player || attacker.canAttackHero)
			) {
				target = this.player.getOpponent();
			} else {
				this.history.push({ type: "attack, [null, null]", data: [-1, -1] });
				this.prevent.push("attack");
				return [undefined, undefined];
			}
		}

		if (!attacker && this.player.attack > 0 && this.player.canAttack) {
			attacker = this.player as Target;
		}

		const array = [];
		let strbuilder = "";

		if (attacker instanceof Player) {
			array.push(`P${attacker.id + 1}`);
		} else if (attacker instanceof Card) {
			array.push(attacker.uuid);
			strbuilder += `${worstScore}, `;
		}

		if (target instanceof Player) {
			array.push(`P${target.id + 1}`);
		} else if ((target as Target) instanceof Card) {
			array.push(target.uuid);
			strbuilder += bestScore;
		}

		this.history.push({ type: `attack, [${strbuilder}]`, data: array });

		return [attacker, target];
	}
	// -------------

	/**
	 * Makes the ai select a target.
	 *
	 * Gets automatically called by `Interactive.selectTarget`, so use that instead.
	 *
	 * @param prompt The prompt to show the ai.
	 * @param card The card that called this function
	 * @param forceSide The side the ai should be constrained to.
	 * @param forceClass The type of target the ai should be constrained to.
	 * @param flags Some flags
	 *
	 * @returns The target selected.
	 */
	selectTarget(
		prompt: string,
		card: Card | undefined,
		forceSide: SelectTargetAlignment,
		forceClass: SelectTargetClass,
		flags: SelectTargetFlag[] = [],
	): Target | false {
		if (flags.includes("allowLocations") && forceClass !== "hero") {
			const locations = this.player.board.filter(
				(m) =>
					m.type === Type.Location &&
					m.cooldown === 0 &&
					!this.usedLocationsThisTurn.includes(m),
			);
			this.usedLocationsThisTurn.push(locations[0]);

			if (locations.length > 0) {
				return locations[0];
			}
		}

		const opponent = this.player.getOpponent();

		let side = null;

		const score = this.analyzePositive(prompt, false);

		if (score > 0) {
			side = "self";
		} else if (score < 0) {
			side = "enemy";
		}

		if (forceSide !== "any") {
			side = forceSide;
		}

		const sidePlayer = side === "self" ? this.player : opponent;

		if (sidePlayer.board.length <= 0 && forceClass === "minion") {
			this.history.push({ type: "selectTarget", data: "0,1" });

			return false;
		}

		if (forceClass === "hero") {
			let returnValue: Player | false = false;

			if (side === "self") {
				returnValue = this.player;
			} else if (side === "enemy") {
				returnValue = opponent;
			}

			const historyData =
				returnValue instanceof Player ? `P${returnValue.id + 1}` : returnValue;

			this.history.push({ type: "selectTarget", data: historyData });

			return returnValue;
		}

		// The player has no minions, select their face
		if (sidePlayer.board.length <= 0) {
			let returnValue: Player | false = false;

			if (forceClass === "minion") {
				this.history.push({ type: "selectTarget", data: -1 });
			} else {
				returnValue = sidePlayer;
				this.history.push({
					type: "selectTarget",
					data: `P${returnValue.id + 1}`,
				});
			}

			return returnValue;
		}

		let bestMinion: Card | undefined;
		let bestScore = -100_000;

		for (const target of sidePlayer.board) {
			if (!target.canBeAttacked()) {
				continue;
			}

			if (
				(card &&
					card.type === Type.Spell &&
					target.hasKeyword(Keyword.Elusive)) ??
				target.type === Type.Location
			) {
				continue;
			}

			const score = this.analyzePositiveCard(target);

			if (score <= bestScore) {
				continue;
			}

			bestMinion = target;
			bestScore = score;
		}

		if (bestMinion) {
			this.history.push({
				type: "selectTarget",
				data: `${bestMinion.uuid},${bestScore}`,
			});

			return bestMinion;
		}

		this.history.push({ type: "selectTarget", data: -1 });
		return false;
	}

	/**
	 * Choose the "best" card to discover.
	 *
	 * @param cards The cards to choose from
	 *
	 * @returns Result
	 */
	discover(cards: Card[]): Card | undefined {
		let bestCard: Card | undefined;
		let bestScore = -100_000;

		// Look for highest score
		for (const card of cards) {
			const score = this.analyzePositiveCard(card);

			if (score <= bestScore) {
				continue;
			}

			bestCard = card;
			bestScore = score;
		}

		if (!bestCard) {
			return undefined;
		}

		this.history.push({ type: "discover", data: [bestCard.id, bestScore] });
		return bestCard;
	}

	/**
	 * Choose the "best" card to dredge.
	 *
	 * @param cards The cards to choose from
	 *
	 * @returns Result
	 */
	dredge(cards: Card[]): Card | undefined {
		let bestCard: Card | undefined;
		let bestScore = -100_000;

		// Look for highest score
		for (const card of cards) {
			const score = this.analyzePositiveCard(card);

			if (score <= bestScore) {
				continue;
			}

			bestCard = card;
			bestScore = score;
		}

		if (!bestCard) {
			return undefined;
		}

		this.history.push({ type: "dredge", data: [bestCard.uuid, bestScore] });
		return bestCard;
	}

	/**
	 * Choose the "best" option from `options`
	 *
	 * @param options The options the ai can pick from
	 *
	 * @returns The index of the question chosen
	 */
	chooseOne(options: string[]): number | undefined {
		/*
		 * I know this is a bad solution
		 * "Deal 2 damage to a minion; or Restore 5 Health."
		 * ^^^^^ It will always choose to restore 5 health, since it sees deal 2 damage as bad but oh well, future me problem.
		 * ^^^^^ Update 29/05/23  TODO: Fix this
		 */
		let bestChoice: number | undefined;
		let bestScore = -100_000;

		// Look for highest score
		for (const [index, card] of options.entries()) {
			const score = this.analyzePositive(card);

			if (score <= bestScore) {
				continue;
			}

			bestChoice = index;
			bestScore = score;
		}

		this.history.push({ type: "chooseOne", data: [bestChoice, bestScore] });

		return bestChoice;
	}

	/**
	 * Choose the "best" answer from `options`
	 *
	 * @param prompt The prompt to show to the ai
	 * @param options The options the ai can pick from
	 *
	 * @returns The index of the option chosen + 1
	 */
	question(prompt: string, options: string[]): number | undefined {
		let bestChoice = null;
		let bestScore = -100_000;

		for (const [index, card] of options.entries()) {
			const score = this.analyzePositive(card);

			if (score <= bestScore) {
				continue;
			}

			bestChoice = index;
			bestScore = score;
		}

		this.history.push({
			type: `question: ${prompt}`,
			data: [bestChoice, bestScore],
		});

		if (!bestChoice) {
			return undefined;
		}

		return bestChoice + 1;
	}

	/**
	 * Choose yes or no based on the prompt
	 *
	 * @param prompt The prompt to show to the ai
	 *
	 * @returns `true` if "Yes", `false` if "No"
	 */
	yesNoQuestion(prompt: string): boolean {
		const score = this.analyzePositive(prompt);
		const returnValue = score > 0;

		this.history.push({ type: "yesNoQuestion", data: [prompt, returnValue] });

		return returnValue;
	}

	/**
	 * Returns if the ai wants `card` to be traded
	 *
	 * @param card The card to check
	 *
	 * @returns If the card should be traded
	 */
	trade(card: Card): boolean {
		// If the ai doesn't have any cards to trade into, don't trade the card.
		if (this.player.deck.length <= 1) {
			return false;
		}

		// If the ai can't afford to trade, don't trade the card
		if (this.player.mana < 1) {
			return false;
		}

		const score = this.analyzePositiveCard(card);
		const returnValue = score <= game.config.ai.tradeThreshold;

		this.history.push({ type: "trade", data: [card.uuid, returnValue, score] });

		return returnValue;
	}

	/**
	 * Returns if the ai wants `card` to be forged
	 *
	 * @param card The card to check
	 *
	 * @returns If the card should be forged
	 */
	forge(card: Card): boolean {
		// Always forge the card if the ai has enough mana
		const returnValue = !(this.player.mana < 2);

		this.history.push({ type: "forge", data: [card.uuid, returnValue] });
		return returnValue;
	}

	/**
	 * Returns the list of cards the ai wants to mulligan.
	 *
	 * @returns The indexes of the cards to mulligan. Look in `Interact.mulligan` for more details.
	 */
	mulligan(): string {
		let toMulligan = "";
		let scores = "(";

		for (const card of this.player.hand) {
			if (card.uuid === "The Coin") {
				continue;
			}

			const score = this.analyzePositiveCard(card);

			if (score < game.config.ai.mulliganThreshold) {
				toMulligan += (this.player.hand.indexOf(card) + 1).toString();
			}

			scores += `${card.uuid}:${score}, `;
		}

		scores = `${scores.slice(0, -2)})`;

		this.history.push({
			type: `mulligan (T${game.config.ai.mulliganThreshold})`,
			data: [toMulligan, scores],
		});

		return toMulligan;
	}

	/**
	 * Analyze a string and return a score based on how "positive" the ai thinks it is
	 *
	 * @param str The string to analyze
	 * @param context Enable context analysis
	 *
	 * @returns The score the string gets
	 */
	analyzePositive(text: string, _context = true): number {
		const context = _context && game.config.ai.contextAnalysis;

		let score = 0;

		const handleEntriesForV = (
			sentimentObject: [string, Record<string, number>],
			sentance: string,
			word: string,
			previousReturnValue: boolean,
		) => {
			let returnValue = previousReturnValue;

			for (const entry of Object.entries(sentimentObject[1])) {
				if (returnValue) {
					continue;
				}

				// Remove the last "s" or "d" in order to account for plurals
				const sentimentWithoutPlural = entry[0].replace(/^(.*)[sd]$/, "$1");
				if (
					!new RegExp(entry[0]).test(word) &&
					!new RegExp(sentimentWithoutPlural).test(word)
				) {
					continue;
				}

				// If the sentiment is "positive", add to the score. If it is "negative", subtract from the score.
				let pos = entry[1];
				if (context && /enemy|enemies|opponent/.test(sentance)) {
					pos = -pos;
				}

				score -= sentimentObject[0] === "positive" ? -pos : pos;
				returnValue = true;
			}

			return returnValue;
		};

		for (let sentance of text.toLowerCase().split(/[^a-z\d ]/)) {
			sentance = sentance.trim();

			for (let word of sentance.split(" ")) {
				// Filter out any characters not in the alphabet
				word = word.replaceAll(/[^a-z]/g, "");
				let returnValue = false;

				for (const sentimentObject of Object.entries(
					game.config.ai.sentiments,
				)) {
					if (returnValue) {
						continue;
					}

					returnValue = handleEntriesForV(
						sentimentObject,
						sentance,
						word,
						returnValue,
					);
				}
			}
		}

		return score;
	}

	/**
	 * Same as `analyzePositive` but changes the score based on a card's positive and negative values.
	 * Passes the card's description into `analyzePositive`.
	 *
	 * @param c The card to analyze
	 *
	 * @returns The score
	 */
	analyzePositiveCard(c: Card): number {
		let score = this.analyzePositive(c.text || "");

		// Stats
		score +=
			(c.attack && c.health ? c.attack + c.health : game.config.ai.spellValue) *
			game.config.ai.statsBias;

		// Cost
		score -= c.cost * game.config.ai.costBias;

		// Keywords
		for (const _ of Object.keys(c.keywords)) {
			score += game.config.ai.keywordValue;
		}

		// Abilities
		for (const value of Object.values(c)) {
			if (Array.isArray(value) && value[0] instanceof Function) {
				score += game.config.ai.abilityValue;
			}
		}

		return score;
	}

	/**
	 * Checks if there are any minions that can attack on the ai's board
	 *
	 * @returns Can attack
	 */
	private _canAttack(): boolean {
		if (this.prevent.includes("attack")) {
			return false;
		}

		const validAttackers = this.player.board.filter((m) => m.canAttack());

		return validAttackers.length > 0;
	}

	/**
	 * Returns if the ai can use their hero power
	 *
	 * @returns Can use hero power
	 */
	private _canHeroPower(): boolean {
		if (this.prevent.includes("hero power")) {
			return false;
		}

		// The ai has already used their hero power that turn.
		this.prevent.push("hero power");

		return this.player.canUseHeroPower();
	}

	/**
	 * @returns If there are any location cards the ai can use.
	 */
	private _canUseLocation(): boolean {
		if (this.prevent.includes("use")) {
			return false;
		}

		const validLocations = this.player.board.filter(
			(m) =>
				m.type === Type.Location &&
				m.cooldown === 0 &&
				!this.usedLocationsThisTurn.includes(m),
		);

		return validLocations.length > 0;
	}

	// ATTACKING
	/**
	 * Finds all possible trades for the ai and returns them
	 *
	 * @returns `Perfect Trades`: [[attacker, target], ...], `Imperfect Trades`: [[attacker, target], ...]
	 */
	private _attackFindTrades(): [Card[][], Card[][]] {
		const perfectTrades: Card[][] = [];
		const imperfectTrades: Card[][] = [];

		const currentBoard = this.player.board.filter((m) => m.canAttack());

		for (const card of currentBoard) {
			let trades = [...perfectTrades, ...imperfectTrades];

			if (!card.canAttack()) {
				continue;
			}

			const score = this.analyzePositiveCard(card);

			// Don't attack with high-value minions.
			if (
				score > game.config.ai.protectThreshold ||
				trades.map((c) => c[0]).includes(card)
			) {
				continue;
			}

			const opponentBoard = this.player
				.getOpponent()
				.board.filter((m) => m.canBeAttacked());

			for (const target of opponentBoard) {
				trades = [...perfectTrades, ...imperfectTrades];

				if (!target.canBeAttacked()) {
					continue;
				}

				if (trades.map((c) => c[1]).includes(target)) {
					continue;
				}

				const score = this.analyzePositiveCard(target);

				// Don't waste resources attacking useless targets.
				if (score < game.config.ai.ignoreThreshold) {
					continue;
				}

				if (card.attack === target.health) {
					perfectTrades.push([card, target]);
				} else if (
					card.attack &&
					target.health &&
					card.attack > target.health
				) {
					imperfectTrades.push([card, target]);
				}
			}
		}

		return [perfectTrades, imperfectTrades];
	}

	/**
	 * Returns a score for the player specified based on how good their position is.
	 *
	 * @param player The player to score
	 * @param board The board to check
	 *
	 * @returns Score
	 */
	private _scorePlayer(player: Player, board: ScoredCard[][]): number {
		let score = 0;

		for (const scoredCard of board[player.id]) {
			score += scoredCard.score;
		}

		for (const entry of Object.entries(player)) {
			const [key, value] = entry as [string, number];

			if (typeof value !== "number") {
				continue;
			}

			const validKeys = ["health", "maxHealth", "armor", "emptyMana"];
			if (!validKeys.includes(key)) {
				continue;
			}

			score += value;
		}

		score += player.deck.length;

		return score;
	}

	/**
	 * Returns the player that is winning
	 *
	 * @param board The board to check
	 *
	 * @returns Winner, Score
	 */
	private _findWinner(board: ScoredCard[][]): [Player, number] {
		const score = this._scorePlayer(this.player, board);
		const opponentScore = this._scorePlayer(this.player.getOpponent(), board);

		const winner =
			score > opponentScore ? this.player : this.player.getOpponent();
		const winnerScore = winner === this.player ? score : opponentScore;

		return [winner, winnerScore];
	}

	/**
	 * @returns The taunts on the board
	 */
	private _findTaunts(): Card[] {
		return this.player
			.getOpponent()
			.board.filter((m) => m.hasKeyword(Keyword.Taunt));
	}

	/**
	 * Does a trade
	 *
	 * @returns Attacker, Target
	 */
	private _attackTrade(): Card[] {
		const [perfectTrades, imperfectTrades] = this._attackFindTrades();
		const returnValue =
			perfectTrades.length > 0 ? perfectTrades[0] : imperfectTrades[0];

		if (returnValue) {
			this.history.push({
				type: "trade",
				data: [returnValue[0].uuid, returnValue[1].uuid],
			});
		}

		return returnValue;
	}

	/**
	 * Does a general attack
	 *
	 * @param board
	 *
	 * @returns Attacker, Target
	 */
	private _attackGeneral(board: ScoredCard[][]): Array<Target | -1> {
		const winner = this._findWinner(board);

		// Risky
		const opponentScore = this._scorePlayer(this.player.getOpponent(), board);

		// If the ai is winner by more than 'threshold' points, enable risk mode
		const riskMode = winner[1] >= opponentScore + game.config.ai.riskThreshold;

		// If there are taunts, override risk mode
		const taunts = this._findTaunts();

		const returnValue =
			riskMode && taunts.length <= 0
				? this._attackGeneralRisky()
				: this._attackGeneralMinion();

		if (returnValue.includes(-1)) {
			return [-1, -1];
		}

		const returned = returnValue as Target[];

		const getHistoryDataForReturned = (returned: Target) =>
			returned instanceof Card ? returned.uuid : returned.name;

		this.history.push({
			type: "attack",
			data: [
				getHistoryDataForReturned(returned[0]),
				getHistoryDataForReturned(returned[1]),
			],
		});

		// If the ai is not focusing on a minion, focus on the returned minion
		if (!this.focus && returned[1] instanceof Card) {
			this.focus = returned[1];
		}

		return returned;
	}

	/**
	 * Does a risky attack.
	 *
	 * @returns Attacker, Target
	 */
	private _attackGeneralRisky(): Array<Target | -1> {
		// If the opponent is immune, just attack a minion
		const opponent = this.player.getOpponent();
		if (opponent.immune) {
			return this._attackGeneralMinion();
		}

		// Only attack the enemy hero
		return [this._attackGeneralChooseAttacker(true), opponent];
	}

	/**
	 * Chooses the attacker and target
	 *
	 * Use the return value of this function to actually attack by passing it into `game.attack`
	 *
	 * @returns Attacker, Target
	 */
	private _attackGeneralMinion(): Array<Target | -1> {
		// If the focused minion doesn't exist, select a new minion to focus
		if (this.focus) {
			if (!this.player.getOpponent().board.includes(this.focus)) {
				// If the focused card is not on the board
				this.focus = undefined;
			} else if (!this.focus.canBeAttacked()) {
				// If the focused card can't be attacked
				this.focus = undefined;
			}
		}

		const target =
			!this.focus ||
			(this._findTaunts().length > 0 && !this.focus.hasKeyword(Keyword.Taunt))
				? this._attackGeneralChooseTarget()
				: this.focus;

		return [
			this._attackGeneralChooseAttacker(target instanceof Player),
			target,
		];
	}

	/**
	 * Choose a target for a general attack
	 *
	 * @returns Target | -1 (Go back)
	 */
	private _attackGeneralChooseTarget(): Target | -1 {
		const opponent = this.player.getOpponent();
		let highestScore: Array<Target | number | undefined> = [undefined, -9999];

		let board = opponent.board;

		// If there is a taunt, select that as the target
		const taunts = this._findTaunts();
		if (Array.isArray(taunts) && taunts.length > 0) {
			return taunts[0];
		}

		board = board.filter((m) => m.canBeAttacked());

		for (const card of board) {
			if (typeof highestScore[1] !== "number") {
				highestScore[1] = -9999;
			}

			const score = this.analyzePositiveCard(card);
			if (score < highestScore[1]) {
				continue;
			}

			highestScore = [card, score];
		}

		const target = highestScore[0];

		if (!target) {
			// If a target wasn't found, but the opponent can be attacked, attack the opponent
			if (opponent.canBeAttacked()) {
				return opponent;
			}

			// Otherwise, don't attack
			this.prevent.push("attack");
			return -1;
		}

		// Only -1 is a valid number
		if (typeof target === "number" && target !== -1) {
			return -1;
		}

		return target;
	}

	/**
	 * Choose an attacker for a general attack
	 *
	 * @param targetIsPlayer If the target is a player
	 *
	 * @returns Attacker | -1 (Go back)
	 */
	private _attackGeneralChooseAttacker(targetIsPlayer = false): Target | -1 {
		let lowestScore: Array<Target | number | undefined> = [undefined, 9999];

		let board = this.player.board;
		board = board.filter((c) => c.canAttack());

		for (const card of board) {
			if (typeof lowestScore[1] !== "number") {
				lowestScore[1] = 9999;
			}

			const score = this.analyzePositiveCard(card);

			if (
				score > lowestScore[1] ||
				(score > game.config.ai.protectThreshold && !targetIsPlayer)
			) {
				continue;
			}

			if (!card.canAttack()) {
				continue;
			}

			if (targetIsPlayer && !card.canAttackHero) {
				continue;
			}

			lowestScore = [card, score];
		}

		const attacker = lowestScore[0];

		// TODO: Does this never fail?
		if (!attacker && this.player.attack > 0 && this.player.canAttack) {
			return this.player;
		}

		if (!attacker) {
			this.prevent.push("attack");
			return -1;
		}

		// Only -1 is a valid number
		if (typeof attacker === "number" && attacker !== -1) {
			return -1;
		}

		return attacker;
	}
}
