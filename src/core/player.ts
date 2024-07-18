/**
 * Player
 * @module Player
 */
import { type Ai, Card } from "@Game/internal.js";

import {
	Ability,
	Class,
	Event,
	Keyword,
	type QuestCallback,
	type QuestType,
	type Target,
	Type,
} from "@Game/types.js";

export class Player {
	/**
	 * You might be looking for `Player.id`.
	 *
	 * The player's name. For example: "Player 1".
	 *
	 * There is no real use for this outside of the source code, so i would advise you to not use this.
	 */
	name = "Unknown";

	/**
	 * This is:
	 *
	 * 0: if this is the starting player
	 *
	 * 1: if this is the player that starts with the coin
	 *
	 * You can use this in `player.board` in order to get this player's side of the board.
	 *
	 * # Examples
	 * @example
	 * const board = player.board;
	 *
	 * for (const card of board) {
	 *     console.log(card.name);
	 * }
	 */
	id = -1;

	/**
	 * The player's AI.
	 *
	 * # Examples
	 * @example
	 * const discover = player.ai.discover();
	 *
	 * console.log(discover);
	 */
	ai?: Ai;

	/**
	 * How much damage the player gets damaged the next time they draw a card from an empty deck.
	 *
	 * This increments every time a player draws from an empty deck.
	 */
	fatigue = 0;

	/**
	 * The player's deck.
	 *
	 * This can be shuffled at any time so don't rely on the order of the cards.
	 *
	 * # Examples
	 * @example
	 * for (const card of player.deck) {
	 *     console.log(card.name);
	 * }
	 */
	deck: Card[] = [];

	/**
	 * The player's hand.
	 *
	 * # Examples
	 * @example
	 * for (const card of player.hand)
	 *     console.log(card.name);
	 * }
	 */
	hand: Card[] = [];

	/**
	 * The player's side of the board.
	 *
	 * # Examples
	 * @example
	 * for (const card of player.board)
	 *     console.log(card.name);
	 * }
	 */
	board: Card[] = [];

	/**
	 * The player's side of the graveyard, a list of cards that have been killed.
	 *
	 * # Examples
	 * @example
	 * for (const card of player.graveyard)
	 *     console.log(card.name);
	 * }
	 */
	graveyard: Card[] = [];

	/**
	 * The amount of mana that the player CURRENTLY has.
	 *
	 * # Examples
	 * @example
	 * // Use `player.refreshMana(2, player.maxMana)` instead in a real situation.
	 * player.mana += 2;
	 */
	mana = 0;

	/**
	 * The amount of empty mana crystals the player has. This increments every turn until it reaches `player.maxMana`.
	 *
	 * # Examples
	 * @example
	 * // Use `player.addEmptyMana(2)` instead in a real situation.
	 * player.emptyMana += 2;
	 */
	emptyMana = 0;

	/**
	 * The max amount of mana the player can have. This is normally fixed at `10` but can be changed.
	 *
	 * # Examples
	 * ```
	 * player.maxMana = 20;
	 * // Now `player.maxMana` will increment every turn until it reaches 20.
	 * ```
	 */
	maxMana = 10;

	/**
	 * The amount of overload the player has. See the overload mechanic on the Hearthstone Wiki.
	 *
	 * # Examples
	 * ```
	 * // Use `player.addOverload(2)` instead in a real situation.
	 * player.overload += 2;
	 * // Now the player will have 2 less mana next turn.
	 * ```
	 */
	overload = 0;

	/**
	 * The amount of health the player has.
	 *
	 * # Examples
	 * ```
	 * // Use `player.remHealth(3)` instead in a real situation.
	 * player.health -= 3;
	 * ```
	 */
	health = 30;

	/**
	 * The maximum health the player can have. This is normally fixed to the amount of health the player starts with (`30`).
	 *
	 * # Examples
	 * ```
	 * player.maxHealth = 40;
	 * ```
	 */
	maxHealth = 30;

	/**
	 * The amount of armor the player has.
	 *
	 * # Examples
	 * ```
	 * player.armor += 3;
	 * ```
	 */
	armor = 0;

	/**
	 * The hero card that the player has. This is normally set to one of the starting heroes.
	 *
	 * # Examples
	 * ```
	 * // We're assuming that the player is a Priest, and hasn't played a hero card.
	 * assert.equal(typeof player.hero.heropower, 'function');
	 * assert.equal(player.hero.name, "Priest Starting Hero");
	 *
	 * // Activate the hero's hero power. (`Restore 2 Health.`)
	 * player.hero.activate("heropower");
	 * ```
	 */
	hero: Card;

	/**
	 * The class the player is. This is set to either: Mage, Priest, Warlock, Warrior, ...
	 */
	heroClass: Class = Class.Mage;

	/**
	 * If the player can use their hero power.
	 *
	 * This resets to true every turn.
	 */
	hasUsedHeroPowerThisTurn = false;

	/**
	 * If the player's hero power is disabled.
	 *
	 * This has to manually be set.
	 */
	disableHeroPower = false;

	/**
	 * The player's weapon. Functions like any other card.
	 *
	 * # Examples
	 * ```
	 * // Use `player.destroyWeapon()` instead in a real situation.
	 * player.weapon.kill();
	 * ```
	 */
	weapon?: Card;

	/**
	 * If the player can attack.
	 * This is set to `true` by default, and only gets set to `false` once the player attacks, and is reset to `true` at the end of the turn.
	 */
	canAttack = true;

	/**
	 * If the player is frozen.
	 *
	 * If a player is frozen, they can't attack.
	 */
	frozen = false;

	/**
	 * If the player is immune to damage.
	 */
	immune = false;

	/**
	 * How much attack the player has.
	 */
	attack = 0;

	/**
	 * How much spell damage the player has.
	 */
	spellDamage = 0;

	/**
	 * The card types to counter.
	 *
	 * If this player's counter includes "Minion", and this player plays a Minion, it gets countered.
	 */
	counter: Type[] = [];

	/**
	 * The secrets that the player has.
	 */
	secrets: QuestType[] = [];

	/**
	 * The sidequests that the player has.
	 */
	sidequests: QuestType[] = [];

	/**
	 * The quest that the player has.
	 */
	quests: QuestType[] = [];

	/**
	 * How much attack/health (+1) the player's next jade golem will have.
	 */
	jadeCounter = 0;

	/**
	 * How many corpses the player has.
	 *
	 * This increases even if the player is not a Death Knight, so don't count on this number telling you if the player is a Death Knight or not.
	 */
	corpses = 0;

	/**
	 * A three letter rune combination. For example "BBB" for 3 blood runes, or "BFU" for one of each rune.
	 */
	runes = "";

	/**
	 * If this is not null, it will automatically choose this target when asked instead of asking the player.
	 *
	 * # Example
	 * ```
	 * player.forceTarget = target;
	 * const chosen = game.interact.selectTarget("Example", null, "any", "any");
	 * player.forceTarget = null;
	 *
	 * assert.equal(chosen, target);
	 * ```
	 */
	forceTarget?: Target;

	/**
	 * Answers for the player.
	 *
	 * If this is a list, whenever the game asks for input from the user, instead it answers with the first element from the list, then it removes that element from the list.
	 *
	 * If this is a string, whenever the game asks for input from the user, instead it just answers with that string, and doesn't remove it.
	 *
	 * # Example
	 * ```
	 * // Only run this code when the player's turn starts
	 * player.inputQueue = ["attack", "1", "1", "end"]; // Does these commands in order
	 *
	 * // Once it has done all these commands, `player.inputQueue` = null
	 * ```
	 *
	 * #### Or with just a string
	 *
	 * ```
	 * // Whenever the game asks the player a question, just answer with `e` every time. This will most likely make the game unplayable, however in certain contexts this can be useful.
	 * player.inputQueue = "e";
	 * ```
	 */
	inputQueue?: string | string[];

	/**
	 * If the player has `detail mode` enabled.
	 *
	 * This gets enabled when the player enters the `detail` command.
	 */
	detailedView = false;

	constructor(name: string) {
		this.name = name;
	}

	/**
	 * Retrieves the player corresponding to the given id.
	 * 0 is Player 1.
	 * 1 is Player 2.
	 *
	 * @param id The id of the player - 1.
	 *
	 * @returns The player
	 */
	static fromID(id: number) {
		if (id === 0) {
			return game.player1;
		}

		return game.player2;
	}

	/**
	 * Get this player's opponent
	 *
	 * # Examples
	 * ```
	 * const opponent = player.getOpponent();
	 *
	 * assert.notEqual(player.id, opponent.id);
	 * ```
	 */
	getOpponent(): Player {
		if (this.id === 0) {
			return game.player2;
		}

		return game.player1; // We always need to return a player.
	}

	// Mana

	/**
	 * Adds `mana` to this player, without going over `comp` mana.
	 *
	 * # Examples
	 * ```
	 * assert.equal(player.emptyMana, 7);
	 * assert.equal(player.mana, 5);
	 *
	 * player.refreshMana(10);
	 *
	 * assert.equal(player.mana, 7);
	 * ```
	 * If comp is `player.maxMana`
	 * ```
	 * assert.equal(player.emptyMana, 7);
	 * assert.equal(player.mana, 5);
	 *
	 * player.refreshMana(10, player.maxMana);
	 *
	 * assert.equal(player.mana, 10);
	 * ```
	 * You can set comp to any value
	 * ```
	 * assert.equal(player.mana, 5);
	 *
	 * player.refreshMana(10, 200);
	 *
	 * assert.equal(player.mana, 15);
	 * ```
	 *
	 * @param mana The mana to add
	 * @param comp The comperison. This defaults to `player.emptyMana`.
	 *
	 * @returns Whether or not the mana was capped
	 */
	refreshMana(mana: number, comp?: number): boolean {
		const comperison = comp ?? this.emptyMana;

		this.mana += mana;

		if (this.mana > comperison) {
			this.mana = comperison;
			return true;
		}

		return false;
	}

	/**
	 * Increases empty mana by `mana`, avoids going over `player.maxMana` (10 by default) mana.
	 *
	 * # Examples
	 * If you set `cap` to true
	 * ```
	 * assert.equal(player.emptyMana, 5);
	 *
	 * player.addEmptyMana(10);
	 *
	 * assert.equal(player.emptyMana, 10);
	 * ```
	 *
	 * @param mana The empty mana to add.
	 *
	 * @returns Whether or not the empty mana was capped to the max mana
	 */
	addEmptyMana(mana: number): boolean {
		this.emptyMana += mana;

		if (this.emptyMana > this.maxMana) {
			this.emptyMana = this.maxMana;
			return true;
		}

		return false;
	}

	/**
	 * Increases both mana and empty mana by `mana`.
	 *
	 * This function runs
	 * ```
	 * player.addEmptyMana(mana);
	 * player.refreshMana(mana);
	 * ```
	 * so look at these functions for more info.
	 *
	 * @param mana The number to increase mana and empty mana by
	 *
	 * @returns Whether or not the mana or empty mana was capped
	 */
	addMana(mana: number): boolean {
		const emptyCapped = this.addEmptyMana(mana);
		const fullCapped = this.refreshMana(mana, this.maxMana);

		return emptyCapped || fullCapped;
	}

	/**
	 * Increases the players overload by `overload`. Overload will not take into affect until the player's next turn.
	 *
	 * ```
	 * assert.equal(player.overload, 0);
	 *
	 * player.addOverload(2);
	 *
	 * assert.equal(player.overload, 2);
	 * ```
	 *
	 * @param overload The amount of overload to add
	 *
	 * @returns Success
	 */
	addOverload(overload: number): boolean {
		this.overload += overload;

		game.event.broadcast(Event.GainOverload, overload, this);
		return true;
	}

	// Weapons

	/**
	 * Sets this player's weapon to `weapon`
	 *
	 * # Examples
	 * ```
	 * const weapon = game.createCard(game.cardIds.notRealExampleWeapon0, player);
	 * player.setWeapon(weapon);
	 * ```
	 *
	 * @param weapon The weapon to set
	 *
	 * @returns Success
	 */
	setWeapon(weapon: Card): boolean {
		this.destroyWeapon();
		this.weapon = weapon;
		this.attack += weapon.attack ?? 0;

		return true;
	}

	/**
	 * Destroys this player's weapon
	 *
	 * # Examples
	 * ```
	 * // Assume the player has a weapon with 5 attack and the player hasn't attacked this turn.
	 * assert.equal(player.weapon.attack, 5);
	 * assert.equal(player.attack, 5);
	 *
	 * player.destroyWeapon();
	 *
	 * assert.equal(player.weapon, null);
	 * assert.equal(player.attack, 0);
	 * ```
	 *
	 * @returns Success
	 */
	destroyWeapon(): boolean {
		if (!this.weapon) {
			return false;
		}

		this.weapon.activate(Ability.Deathrattle);
		this.attack -= this.weapon.attack ?? 0;

		this.weapon.destroy();
		this.weapon = undefined;

		return true;
	}

	// Stats

	/**
	 * Increases the player's armor by `amount`.
	 *
	 * @param amount The amount the player's armor should increase by
	 *
	 * @returns Success
	 */
	addArmor(amount: number): boolean {
		this.armor += amount;
		return true;
	}

	/**
	 * Increases the player's attack by `amount`.
	 *
	 * @param amount The amount the player's attack should increase by
	 *
	 * @returns Success
	 */
	addAttack(amount: number): boolean {
		this.attack += amount;

		game.event.broadcast(Event.GainHeroAttack, amount, this);
		return true;
	}

	/**
	 * Increases the player's health by `amount`
	 *
	 * @param amount The amount the player's health should increase by
	 *
	 * @returns Whether or not the health was capped to the max health.
	 */
	addHealth(amount: number): boolean {
		this.health += amount;

		if (this.health > this.maxHealth) {
			this.health = this.maxHealth;
			return true;
		}

		return false;
	}

	/**
	 * Decreases the player's health by `amount`. If the player has armor, the armor gets decreased instead.
	 *
	 * This also handles the player being dealt a fatal attack. In other words, if this function causes the player to die, it will immediately end the game.
	 * Broadcasts the `TakeDamage` event and the `FatalDamage`? event
	 *
	 * @param amount The amount the player's health should decrease by
	 *
	 * @returns Success
	 */
	remHealth(amount: number): boolean {
		if (this.immune) {
			return true;
		}

		// Armor logic
		const remainingArmor = this.armor - amount;
		this.armor = Math.max(remainingArmor, 0);

		// Armor blocks all damage, return true since there were no errors.
		if (remainingArmor >= 0) {
			return true;
		}

		/*
		 * The amount of damage to take is however much damage penetrated the armor.
		 * The remaining armor is negative, so turn it into a positive number so it's easier to work with
		 */
		const actualAmount = Math.abs(remainingArmor);

		this.health -= actualAmount;

		game.event.broadcast(Event.TakeDamage, actualAmount, this);

		if (!this.isAlive()) {
			game.event.broadcast(Event.FatalDamage, undefined, this);

			// This is done to allow secrets to prevent death
			if (!this.isAlive()) {
				game.endGame(this.getOpponent());
			}
		}

		return true;
	}

	// Hand / Deck

	/**
	 * Shuffles this player's deck
	 */
	shuffleDeck(): void {
		this.deck = game.lodash.shuffle(this.deck);
	}

	/**
	 * Shuffle a card into this player's deck. This will shuffle the deck.
	 * Broadcasts the `AddCardToDeck` event.
	 *
	 * This gets acheived by adding the card to the top of the deck, then shuffling the entire deck.
	 *
	 * ```
	 * assert.equal(player.deck.length, 30);
	 *
	 * const card = game.createCard(game.cardIds.sheep1, player);
	 * player.shuffleIntoDeck(card);
	 *
	 * assert.equal(player.deck.length, 31);
	 * ```
	 *
	 * @param card The card to shuffle
	 *
	 * @returns Success
	 */
	shuffleIntoDeck(card: Card): boolean {
		// Push the card to the top of the deck, then shuffle it
		this.deck.push(card);
		this.shuffleDeck();

		game.event.broadcast(Event.AddCardToDeck, card, this);
		return true;
	}

	/**
	 * Adds a card to the bottom of this player's deck. This keeps the order of the deck..
	 * Broadcasts the `AddCardToDeck` event
	 *
	 * @param card The card to add to the bottom of the deck
	 *
	 * @returns Success
	 */
	addToBottomOfDeck(card: Card): boolean {
		this.deck.unshift(card);

		game.event.broadcast(Event.AddCardToDeck, card, this);
		return true;
	}

	/**
	 * Draws `amount` cards from this player's deck.
	 * Broadcasts the `DrawCard` event for each card drawn
	 *
	 * @param amount The amount of cards to draw
	 * @returns The cards drawn
	 */
	drawCards(amount: number): Card[] {
		const cards: Card[] = [];

		const unsuppress = game.functions.event.suppress(Event.AddCardToHand);

		let drawAmount = amount;
		for (let i = 0; i < drawAmount; i++) {
			// We need the `deckLength` variable since pop may change the length of the deck
			const deckLength = this.deck.length;
			const card = this.deck.pop();

			// Fatigue
			if (deckLength <= 0 || !card) {
				this.fatigue++;

				this.remHealth(this.fatigue);
				continue;
			}

			// Cast on draw
			if (
				card.type === Type.Spell &&
				card.hasKeyword(Keyword.CastOnDraw) &&
				card.activate(Ability.Cast)
			) {
				drawAmount += 1;
				continue;
			}

			// Summon on draw
			if (card.hasKeyword(Keyword.SummonOnDraw) && card.canBeOnBoard()) {
				this.summon(card);

				drawAmount += 1;
				continue;
			}

			this.addToHand(card);
			game.event.broadcast(Event.DrawCard, card, this);
			cards.push(card);
		}

		unsuppress();

		return cards;
	}

	/**
	 * Draws a specific card from this player's deck.
	 * Broadcasts the `DrawCard` event
	 *
	 * # Examples
	 * This works
	 * ```
	 * // Get a random card from the player's deck
	 * const card = game.functions.randList(player.deck).actual;
	 *
	 * player.drawSpecific(card);
	 * ```
	 *
	 * This doesn't work
	 * ```
	 * const card = game.functions.randList(player.deck).copy;
	 *
	 * player.drawSpecific(card);
	 * ```
	 *
	 * @param card The card to draw
	 *
	 * @returns The card drawn
	 */
	drawSpecific(card: Card): Card | undefined {
		if (this.deck.length <= 0) {
			return undefined;
		}

		game.functions.util.remove(this.deck, card);

		if (
			card.type === Type.Spell &&
			card.hasKeyword(Keyword.CastOnDraw) &&
			card.activate(Ability.Cast)
		) {
			return undefined;
		}

		game.functions.event.withSuppressed(Event.AddCardToHand, () =>
			this.addToHand(card),
		);
		game.event.broadcast(Event.DrawCard, card, this);

		return card;
	}

	/**
	 * Adds a card to the player's hand.
	 * Broadcasts the `AddCardToHand` event
	 *
	 * @param card The card to add
	 *
	 * @returns Success
	 */
	addToHand(card: Card): boolean {
		if (this.hand.length >= game.config.general.maxHandLength) {
			return false;
		}

		this.hand.push(card);

		game.event.broadcast(Event.AddCardToHand, card, this);
		return true;
	}

	// Hero power / Class

	/**
	 * Sets the player's hero to `hero`
	 *
	 * @param hero The hero that the player should be set to
	 * @param setHeroClass Set the players hero class.
	 *
	 * @returns Success
	 */
	setHero(hero: Card, setHeroClass = true): boolean {
		this.hero = hero;
		if (setHeroClass) {
			this.heroClass = hero.classes[0];
		}

		this.armor += hero.armor ?? 0;
		return true;
	}

	/**
	 * Sets the player's hero to the default hero of `heroClass`
	 *
	 * @param heroClass The class of the hero. This defaults to the player's class.
	 *
	 * @returns Success
	 */
	setToStartingHero(heroClass = this.heroClass): boolean {
		const heroCardId = game.cardCollections.classes
			.map((heroId) => new Card(heroId, this, true))
			.find((card) => card.classes.includes(heroClass))?.id;

		if (!heroCardId) {
			return false;
		}

		this.setHero(new Card(heroCardId, this), false);

		return true;
	}

	/**
	 * Activate the player's hero power.
	 *
	 * @returns Success | Cancelled
	 */
	heroPower(): boolean | -1 {
		if (!this.canUseHeroPower()) {
			return false;
		}

		if (!this.hero) {
			return false;
		}

		if (this.hero.heropower?.activate(Ability.HeroPower) === Card.REFUND) {
			return -1;
		}

		for (const card of this.board) {
			card.activate(Ability.Inspire);
		}

		this.mana -= this.hero.heropower?.cost ?? 0;
		this.hasUsedHeroPowerThisTurn = true;

		game.event.broadcast(Event.HeroPower, this.hero.heropower, this);
		return true;
	}

	// Other

	/**
	 * Calls `callback` if the player has `amount` corpses. Doesn't work if the player isn't a Death Knight, or if the player doesn't have enough corpses.
	 *
	 * @param amount The amount of corpses to trade
	 * @param callback The function to call when the trade is successful.
	 *
	 * @returns Success
	 */
	tradeCorpses(amount: number, callback: () => void): boolean {
		if (!this.canUseCorpses()) {
			return false;
		}

		if (this.corpses < amount) {
			return false;
		}

		this.corpses -= amount;
		callback();

		return true;
	}

	/**
	 * @returns Whether or not the player can use corpses
	 */
	canUseCorpses(): boolean {
		return [Class.DeathKnight].includes(this.heroClass);
	}

	/**
	 * @returns Whether or not the player can use runes
	 */
	canUseRunes(): boolean {
		return [Class.DeathKnight].includes(this.heroClass);
	}

	/**
	 * @returns If the player can attack
	 */
	canBeAttacked(): boolean {
		return !this.immune;
	}

	/**
	 * @returns If the player can use their heropower
	 */
	canUseHeroPower(): boolean {
		return (
			this.mana >= (this.hero.heropower?.cost ?? 0) &&
			!this.hasUsedHeroPowerThisTurn &&
			!this.disableHeroPower
		);
	}

	/**
	 * @returns If this player is alive
	 */
	isAlive(): boolean {
		return this.health > 0;
	}

	/**
	 * @returns The remaining board space for this player.
	 */
	getRemainingBoardSpace(): number {
		return game.config.general.maxBoardSpace - this.board.length;
	}

	/**
	 * @returns The remaining hand size for this given player.
	 */
	getRemainingHandSpace(): number {
		return game.config.general.maxHandLength - this.hand.length;
	}

	/**
	 * Returns true if the player has the correct runes
	 *
	 * @param runes The runes to test against
	 *
	 * @returns Whether or not the player has the correct runes
	 */
	testRunes(runes: string): boolean {
		const charCount = (text: string, letter: string) => {
			let letterCount = 0;

			for (let i = 0; i < text.length; i++) {
				if (text.charAt(i) === letter) {
					letterCount++;
				}
			}

			return letterCount;
		};

		const requiredBlood = charCount(runes, "B");
		const requiredFrost = charCount(runes, "F");
		const requiredUnholy = charCount(runes, "U");

		const blood = charCount(this.runes, "B");
		const frost = charCount(this.runes, "F");
		const unholy = charCount(this.runes, "U");

		if (
			requiredBlood > blood ||
			requiredFrost > frost ||
			requiredUnholy > unholy
		) {
			return false;
		}

		return true;
	}

	/**
	 * Mulligans the cards from input. Read `interact.mulligan` for more info.
	 *
	 * @param input The ids of the cards to mulligan
	 *
	 * @returns The cards mulligan'd
	 */
	mulligan(input: string): Card[] {
		if (input === "") {
			return [];
		}

		if (!game.lodash.parseInt(input)) {
			game.pause("<red>Invalid input!</red>\n");
			return this.mulligan(input);
		}

		const cards: Card[] = [];
		const mulligan: Card[] = [];

		for (const character of input) {
			mulligan.push(this.hand[game.lodash.parseInt(character) - 1]);
		}

		for (const card of this.hand) {
			// The Coin card shouldn't be mulligan'd
			if (!mulligan.includes(card) || card.id === 2) {
				continue;
			}

			game.functions.util.remove(mulligan, card);

			game.functions.event.withSuppressed(Event.DrawCard, () =>
				this.drawCards(1),
			);
			game.functions.event.withSuppressed(Event.AddCardToDeck, () =>
				this.shuffleIntoDeck(card),
			);
			game.functions.event.withSuppressed(Event.DiscardCard, () =>
				card.discard(),
			);

			cards.push(card);
		}

		return cards;
	}

	/**
	 * Creates and returns a jade golem with the correct stats and cost for this player
	 *
	 * @returns The jade golem
	 */
	createJade(): Card {
		if (this.jadeCounter < 30) {
			this.jadeCounter += 1;
		}

		const count = this.jadeCounter;
		const cost = count < 10 ? count : 10;

		const jade = new Card(game.cardIds.jadeGolem85, this);
		jade.setStats(count, count);
		jade.cost = cost;

		return jade;
	}

	/**
	 * Discards `card` from this player's hand.
	 *
	 * Equivalent to `card.discard()`.
	 *
	 * @returns If the card was successfully discarded
	 */
	discard(card: Card): boolean {
		return card.discard(this);
	}

	/**
	 * Calls `callback` on all this player's targets, including the player itself.
	 *
	 * @param callback The callback to call
	 *
	 * @returns Success
	 */
	doTargets(callback: (target: Target) => void): boolean {
		for (const card of this.board) {
			callback(card);
		}

		callback(this);

		return true;
	}

	/**
	 * @returns If this player's deck has no duplicates.
	 */
	highlander(): boolean {
		const deck = this.deck.map((c) => c.id);

		return new Set(deck).size === deck.length;
	}

	/**
	 * Progress a quest by a value
	 *
	 * @param name The name of the quest
	 * @param value The amount to progress the quest by
	 *
	 * @returns The new progress
	 */
	progressQuest(name: string, value = 1): number | undefined {
		let quest = this.secrets.find((s) => s.name === name);
		if (!quest) {
			quest = this.sidequests.find((s) => s.name === name);
		}

		if (!quest) {
			quest = this.quests.find((s) => s.name === name);
		}

		if (!quest) {
			return undefined;
		}

		quest.progress[0] += value;

		return quest.progress[0];
	}

	/**
	 * Adds a quest / secrets to a player
	 *
	 * @param type The type of the quest
	 * @param card The card that created the quest / secret
	 * @param key The key to listen for
	 * @param amount The amount of times that the quest is triggered before being considered complete
	 * @param callback The function to call when the key is invoked.
	 * @param next The id of the next quest / sidequest / secret that should be added when the quest is done
	 *
	 * @returns Success
	 */
	addQuest(
		type: "Quest" | "Sidequest" | "Secret",
		card: Card,
		key: Event,
		amount: number,
		callback: QuestCallback,
		next?: number,
	): boolean {
		let quests: QuestType[];

		switch (type) {
			case "Quest": {
				quests = this.quests;
				break;
			}

			case "Sidequest": {
				quests = this.sidequests;
				break;
			}

			case "Secret": {
				quests = this.secrets;
				break;
			}

			default: {
				return false;
			}
		}

		if (
			(type.toLowerCase() === "quest" && quests.length > 0) ||
			((type.toLowerCase() === "secret" ||
				type.toLowerCase() === "sidequest") &&
				(quests.length >= 3 || quests.some((s) => s.name === card.name)))
		) {
			this.addToHand(card);
			return false;
		}

		quests.push({
			name: card.name,
			progress: [0, amount],
			key,
			value: amount,
			callback,
			next,
		});
		return true;
	}

	/**
	 * Invoke this player's Galakrond
	 *
	 * @returns Success
	 */
	invoke(): boolean {
		// Find the card in player's deck/hand/hero that begins with "Galakrond, the "
		const deckGalakrond = this.deck.find((c) =>
			c.name.startsWith("Galakrond, the "),
		);
		const handGalakrond = this.hand.find((c) =>
			c.name.startsWith("Galakrond, the "),
		);
		if (
			!deckGalakrond &&
			!handGalakrond &&
			!this.hero.name.startsWith("Galakrond, the ")
		) {
			return false;
		}

		for (const card of this.deck) {
			card.activate(Ability.Invoke);
		}

		for (const card of this.hand) {
			card.activate(Ability.Invoke);
		}

		for (const card of this.board) {
			card.activate(Ability.Invoke);
		}

		if (this.hero.name.startsWith("Galakrond, the ")) {
			this.hero.heropower?.activate(Ability.Cast);
		} else if (deckGalakrond) {
			deckGalakrond.heropower?.activate(Ability.Cast);
		} else if (handGalakrond) {
			handGalakrond.heropower?.activate(Ability.Cast);
		}

		return true;
	}

	/**
	 * Chooses a minion from `list` and puts it onto the board.
	 *
	 * @param list The list to recruit from.
	 * @param amount The amount of minions to recruit.
	 *
	 * @returns Returns the cards recruited.
	 */
	recruit(list: Card[], amount = 1): Card[] {
		let recruitList = list ?? this.deck;
		const clonedList = game.lodash.clone(list);

		recruitList = game.lodash.shuffle([...list]);

		let times = 0;
		const cards: Card[] = [];

		recruitList = list.filter((c) => c.type === Type.Minion);
		for (const card of list) {
			if (times >= amount) {
				continue;
			}

			this.summon(card.imperfectCopy());

			times++;
			cards.push(card);
		}

		for (const card of cards) {
			game.functions.util.remove(clonedList, card);
		}

		return cards;
	}

	/**
	 * Starts a joust.
	 * Reveals a random card from each player's deck.
	 * If the cost of this player's card is higher than the cost of the opponent's card, this player wins.
	 *
	 * @param predicate The predicate to filter cards in both players' deck. Defaults to `() => true`
	 * @param winCondition The win condition. `c1` is the friendly card, `c2` is the enemy card. Defaults to `(c1, c2) => c1.cost > c2.cost`
	 *
	 * @returns If this player won the joust
	 */
	joust(
		predicate: (card: Card) => boolean = () => true,
		winCondition: (c1: Card, c2: Card) => boolean = (c1, c2) =>
			c1.cost > c2.cost,
	): boolean {
		// Select a random card from both player's deck.
		const friendlyCard = game.lodash.sample(
			this.deck.filter((card) => predicate?.(card)),
		);
		const enemyCard = game.lodash.sample(
			this.getOpponent().deck.filter((card) => predicate?.(card)),
		);

		/*
		 * Check if both players have cards. If not, don't reveal them.
		 * The logic is found here: https://hearthstone.wiki.gg/wiki/Joust
		 */
		if (!friendlyCard && !enemyCard) {
			// None of the players have targets. Lose the joust
			return false;
		}

		if (!friendlyCard) {
			// Friendly player has no card. Lose the joust
			return false;
		}

		if (!enemyCard) {
			// Enemy player has no card. Win the joust
			return true;
		}

		// Check which card has the higher cost
		const win = winCondition(friendlyCard, enemyCard);

		// Shuffle the decks of both players
		this.shuffleDeck();
		this.getOpponent().shuffleDeck();

		// Reveal them to both players
		game.event.broadcast(Event.RevealCard, [friendlyCard, "Joust"], this);
		game.event.broadcast(Event.RevealCard, [enemyCard, "Joust"], this);

		console.log("\n--- JOUST ---");
		console.log("Yours: %s", friendlyCard.readable());
		console.log("Opponent: %s", enemyCard.readable());
		console.log("-------------");

		console.log(win ? "You win!" : "You lose!");
		game.pause("");

		return win;
	}

	/**
	 * Summon a card.
	 * Broadcasts the `SummonCard` event
	 *
	 * @param card The card to summon
	 * @param colossal If the card has colossal, summon the other cards.
	 *
	 * @returns The card summoned
	 */
	summon(card: Card, colossal = true) {
		return game.summon(card, this, colossal);
	}

	/**
	 * Makes this player attack a minion or hero
	 *
	 * This is just a shortcut for `game.attack(this, target, force)`. Whether to use this or `game.attack` is up to you and your preferences.
	 *
	 * @param target The target
	 * @param force Whether to force the attack. This will bypass any attack restrictions. By default, this is false.
	 *
	 * @returns Success | Errorcode
	 */
	attackTarget(target: Target, force = false) {
		return game.attack(this, target, force);
	}

	/**
	 * Spawns a DIY card for this player.
	 */
	spawnInDIYCard(): void {
		// Don't allow ai's to get diy cards
		if (this.ai) {
			return;
		}

		const list = Card.all(true).filter((card) => /DIY \d+/.test(card.name));
		const card = game.lodash.sample(list);
		if (!card) {
			return;
		}

		card.owner = this;
		this.addToHand(card);
	}
}
