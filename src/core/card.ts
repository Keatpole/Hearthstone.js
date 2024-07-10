/**
 * Card
 * @module Card
 */
import { randomUUID } from "node:crypto";
import type { Player } from "@Game/internal.js";
import {
	Ability,
	type AbilityCallback,
	type Blueprint,
	type CardBackup,
	Class,
	CostType,
	type EnchantmentDefinition,
	Event,
	type GameConfig,
	Keyword,
	Rarity,
	type SpellSchool,
	type Target,
	type Tribe,
	Type,
	type UnknownEventValue,
} from "@Game/types.js";

/**
 * Use this error type when throwing an error in a card
 */
export class CardError extends Error {
	constructor(message: string) {
		super(message);
		Object.setPrototypeOf(this, CardError.prototype);
		this.name = "CardError";
	}
}

export class Card {
	// All

	/**
	 * The name of the card.
	 *
	 * Please do not change this in code.
	 */
	name: string;

	/**
	 * The card's description / text.
	 *
	 * Might include color tags like `Example [033Example 2[142`.
	 * Use `stripAnsi()` to remove these.
	 */
	text: string;

	/**
	 * The cost of the card.
	 */
	cost = 0;

	/**
	 * This is the class that the card belongs to. E.g. "Warlock" or "Mage".
	 */
	classes: Class[] = [Class.Neutral];

	/**
	 * This is the type of card, e.g. "Spell" or "Minion".
	 */
	type: Type = Type.Undefined;

	/**
	 * This is the rarity of the card. E.g. "Common" | "Rare" | etc...
	 */
	rarity: Rarity = Rarity.Free;

	/**
	 * The id tied to the blueprint of the card.
	 * This differentiates cards from each other, but not cards with the same blueprint.
	 * Use uuid for that.
	 *
	 * @example
	 * const sheep = game.createCard(game.cardIds.sheep1, player);
	 * const anotherSheep = game.createCard(game.cardIds.sheep1, player);
	 *
	 * const theCoin = game.createCard(game.cardIds.theCoin2, player);
	 *
	 * assert.equal(sheep.id, anotherSheep.id);
	 * assert.notEqual(sheep.id, theCoin.id);
	 */
	id = -1;

	/**
	 * If the card is collectible.
	 * - Uncollectible cards cannot be added to a deck, and cannot be found in card pools unless explicitly stated otherwise.
	 * - Uncollectible cards can mostly only be explicitly created by other collectible cards.
	 */
	collectible = false;

	/**
	 * The keywords that the card has. E.g. ["Taunt", "Divine Shield", etc...]
	 */
	keywords: { [key in Keyword]?: unknown } = {};

	/**
	 * The card's blueprint.
	 * This is the baseline of the card
	 */
	blueprint: Blueprint;

	// Minion / Weapon

	attack?: number;
	health?: number;

	/**
	 * The tribe the card belongs to.
	 */
	tribe?: Tribe;

	/**
	 * The number of times a minion can attack in a turn;
	 * - Default: 1
	 * - With Windfury: 2
	 * - With Mega-Windfury: 4
	 */
	attackTimes?: number = 1;

	/**
	 * If this is true, the card is exhausted and so can't attack this turn.
	 *
	 * Automatically gets set to true when the card attacks, and gets set to false at the end of the player's turn.
	 */
	sleepy?: boolean = true;

	/**
	 * The maximum health of the card.
	 */
	maxHealth?: number;

	// Spell

	/**
	 * If the card is a spell, this is the school of the spell. E.g. "Fire" or "Frost" or "Fel".
	 */
	spellSchool?: SpellSchool;

	// Hero

	armor?: number;
	heropowerId?: number;
	heropower?: Card;

	// Location

	/**
	 * The durability of the location card
	 */
	durability?: number;

	/**
	 * The cooldown of the location card.
	 */
	cooldown?: number = 2;

	// Not-null

	/**
	 * What currency this card costs.
	 * If this is "mana", the card costs `Player.mana`.
	 * If this is "armor", the card costs `Player.armor`.
	 * If this is "health", the card costs `Player.health`.
	 * etc...
	 *
	 * This can be any value, as long as it is a defined _number_ in the `Player` class.
	 */
	costType: CostType = CostType.Mana;

	/**
	 * Information stored in the card.
	 * This information can be anything, and the card can access it at any point.
	 *
	 * I do not recommend changing this in any other context than in a card's blueprint, unless you know what you are doing.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Cards should be able to store any value. It is hacky, but oh well.
	storage: Record<string, any> = {};

	/**
	 * The turn that the card was played / created.
	 */
	turn: number;

	/**
	 * The card's enchantments.
	 * Formatted like this:
	 *
	 * ```json
	 * [
	 *     {
	 *         "enchantment": "-1 cost",
	 *         "owner": // someCard
	 *     }
	 * ]
	 * ```
	 */
	enchantments: EnchantmentDefinition[] = [];

	/**
	 * This overrides `game.config` for the card's owner while importing the card in a deck.
	 *
	 * # Examples
	 * ```ts
	 * card.deckSettings = {
	 *     deck: {
	 *         maxDeckLength: 40,
	 *         minDeckLength: 40
	 *     }
	 * };
	 * ```
	 */
	deckSettings?: GameConfig;

	/**
	 * The owner of this card.
	 */
	owner: Player;

	/**
	 * A list of backups of this card.
	 *
	 * The card backups don't include the methods so don't call any.
	 */
	backups: Record<string | number, CardBackup> = {};

	/**
	 * The card's uuid. Gets randomly generated when the card gets created.
	 */
	uuid: string;

	// Could be null

	/**
	 * The turn that the card was killed.
	 *
	 * Set to -1 if the card is not dead.
	 */
	turnKilled?: number;

	/**
	 * The runes of the card.
	 */
	runes?: string;

	/**
	 * The amount of spell damage the card has.
	 */
	spellDamage?: number;

	/**
	 * The amount of turns stealth should last.
	 *
	 * Set to 0 if the card is does not have a stealth duration.
	 */
	stealthDuration?: number = 0;

	/**
	 * If the card can attack the hero.
	 *
	 * This will be set to true if the card is a spell and other card types, so verify the type of the card before using this.
	 */
	canAttackHero?: boolean = true;

	/**
	 * Placeholder key-value pairs.
	 *
	 * This should not be used directly, unless you know what you are doing.
	 *
	 * @example
	 * this.placeholder = {
	 *     "turn": game.turns.toString(),
	 * }
	 *
	 * assert.equal(this.text, "The current turn is: {turn}");
	 * // Eventually...
	 * assert.equal(this.text, "The current turn is: 1");
	 */
	placeholder?: Record<string, string> = {};

	/**
	 * The abilities of the card (battlecry, deathrattle, etc...)
	 */
	abilities: { [key in Ability]?: AbilityCallback[] } = {};

	/**
	 * Create a card.
	 *
	 * @param name The name of this card
	 * @param owner This card's owner.
	 * @param [suppressEvent=false] If the "CreateCard" event should be suppressed.
	 */
	constructor(id: number, owner: Player, suppressEvent = false) {
		// Get the blueprint from the cards list
		const blueprint = game.blueprints.find((c) => c.id === id);
		if (!blueprint) {
			throw new Error(`Could not find card with id "${id}"`);
		}

		// Set the blueprint (every thing that gets set before the `doBlueprint` call can be overriden by the blueprint)
		this.blueprint = blueprint;
		this.name = blueprint.name;

		// The turn the card was played
		this.turn = game.turn;

		// Redundant, makes the TypeScript compiler shut up
		this.type = this.blueprint.type;

		// Set maxHealth if the card is a minion or weapon
		this.maxHealth = this.blueprint.health;
		this.owner = owner;

		// Override the properties from the blueprint
		this.doBlueprint(false);
		this.randomizeUUID();

		const placeholder = this.activate(Ability.Placeholders);

		// This is a list of replacements.
		if (Array.isArray(placeholder)) {
			this.placeholder = placeholder[0] as Record<string, string>;
		}

		this.activate(Ability.Create);
		this.replacePlaceholders();

		/*
		 * Properties after this point can't be overriden
		 * Make a backup of "this" to be used when silencing this card
		 */
		if (!this.backups.init) {
			this.backups.init = {} as CardBackup;
		}

		for (const entry of Object.entries(this)) {
			// HACK: Never usage
			this.backups.init[entry[0] as never] = entry[1] as never;
		}

		let unsuppress: undefined | (() => boolean);
		if (suppressEvent) {
			unsuppress = game.functions.event.suppress(Event.CreateCard);
		}

		game.event.broadcast(Event.CreateCard, this, this.owner);

		if (unsuppress) {
			unsuppress();
		}
	}

	static REFUND: -1 = -1;

	/**
	 * Returns all cards with the name `name`.
	 *
	 * @param refer If this should call `getCardById` if it doesn't find the card from the name
	 *
	 * @example
	 * const cards = Card.allFromName('The Coin');
	 *
	 * assert.ok(card[0] instanceof Card);
	 * assert.equal(card[0].name, 'The Coin');
	 */
	static allFromName(name: string, refer = true): Card[] {
		const id = Card.fromID(game.lodash.parseInt(name));

		/*
		 * For some reason, "10 Mana" turns into 10 when passed through `parseInt`.
		 * So we check if it has a space
		 */
		if (id && refer && !name.includes(" ")) {
			return [id];
		}

		return Card.all(true).filter(
			(c) => c.name.toLowerCase() === name.toLowerCase(),
		);
	}

	/**
	 * Creates a card with the given name for the specified player. If there are multiple cards with the same name, this will use the first occurrence.
	 *
	 * @returns The created card, or undefined if no card is found.
	 */
	static fromName(name: string, player: Player): Card | undefined {
		const cards = Card.allFromName(name);
		if (cards.length <= 0) {
			return undefined;
		}

		return new Card(cards[0].id, player, true);
	}

	/**
	 * Returns the card with the id of `id`.
	 *
	 * @example
	 * const card = Card.fromID(2);
	 *
	 * assert.ok(card instanceof Card);
	 * assert.equal(card.name, 'The Coin');
	 */
	static fromID(id: number): Card | undefined {
		return Card.all(true).find((c) => c.id === id);
	}

	/**
	 * Returns all cards added to Hearthstone.js from the "cards" folder.
	 *
	 * @param include_uncollectible If it should include all uncollectible cards
	 */
	static all(include_uncollectible = false): Card[] {
		// Don't broadcast CreateCard event here since it would spam the history and log files
		if (game.cards.length <= 0) {
			game.cards = game.blueprints.map(
				(card) => new Card(card.id, game.player, true),
			);

			game.functions.card.generateIdsFile();
		}

		return game.cards.filter((c) => c.collectible || include_uncollectible);
	}

	/**
	 * Returns the card with the given UUID wherever it is.
	 *
	 * This searches both players' deck, hand, board, and graveyard.
	 *
	 * @param uuid The UUID to search for. This matches if the card's UUID starts with the given UUID (this).
	 * @returns The card that matches the UUID, or undefined if no match is found.
	 */
	static fromUUID(uuid: string): Card | undefined {
		let card: Card | undefined;

		/**
		 * Searches for a UUID in the given array of cards and updates the 'card' variable if found.
		 *
		 * @param where The array of cards to search
		 */
		function lookForUUID(where: Card[]): void {
			const foundCard = where.find((card) => card.uuid.startsWith(uuid));

			if (foundCard) {
				card = foundCard;
			}
		}

		for (const player of [game.player1, game.player2]) {
			lookForUUID(player.deck);
			lookForUUID(player.hand);
			lookForUUID(player.board);
			lookForUUID(player.graveyard);
		}

		return card;
	}

	/**
	 * Imports and registers all cards from the "cards" folder
	 *
	 * @returns Success
	 */
	static registerAll(): boolean {
		game.functions.util.searchCardsFolder((fullPath) => {
			const blueprint = require(fullPath).blueprint as Blueprint;
			game.blueprints.push(blueprint);
		});

		// Remove falsy values
		game.blueprints = game.blueprints.filter(Boolean);

		if (!game.functions.card.runBlueprintValidator()) {
			throw new Error(
				"Some cards are invalid. Please fix these issues before playing.",
			);
		}

		return true;
	}

	/**
	 * Reloads all cards
	 *
	 * @returns Success
	 */
	static reloadAll(): boolean {
		game.blueprints = [];

		for (const key of Object.keys(require.cache)) {
			if (!key.includes("/cards/")) {
				continue;
			}

			delete require.cache[key];
		}

		return Card.registerAll();
	}

	/**
	 * Randomizes the uuid for this card to prevent cards from being "linked"
	 */
	randomizeUUID(): void {
		this.uuid = randomUUID();
	}

	/**
	 * Sets fields based on the blueprint of the card.
	 *
	 * @param activate If it should trigger the card's `create` ability.
	 */
	doBlueprint(activate = true): void {
		// Reset the blueprint
		this.blueprint =
			game.blueprints.find((c) => c.id === this.id) ?? this.blueprint;

		/*
		 * Go through all blueprint variables and
		 * set them in the card object
		 * Example:
		 * Blueprint: { name: "Sheep", stats: [1, 1], test: true }
		 *                                            ^^^^^^^^^^
		 * Do: this.test = true
		 *
		 * Function Example:
		 * Blueprint: { name: "The Coin", cost: 0, cast(owner, self): { owner.refreshMana(1, owner.maxMana) } }
		 *                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
		 * Do: this.abilities.cast = [{ owner.addMana(1) }]
		 *                           ^                  ^
		 *                           This is in an array so we can add multiple events on casts
		 */
		for (const entry of Object.entries(this.blueprint)) {
			const [key, value] = entry;

			if (typeof value === "function") {
				this.abilities[key as Ability] = [value];
			} else {
				this[key as keyof this] = JSON.parse(JSON.stringify(entry[1]));
			}
		}

		// Set maxHealth if the card is a minion or weapon
		this.maxHealth = this.blueprint.health;

		if (this.heropowerId) {
			this.heropower = new Card(this.heropowerId, this.owner);
		}

		this.text = game.functions.color.fromTags(this.text || "");
		if (activate) {
			this.activate(Ability.Create);
		}
	}

	/**
	 * Adds an ability to the card
	 *
	 * @param ability The name of the ability
	 * @param callback The callback function to add to the ability
	 *
	 * @returns Success
	 */
	addAbility(ability: Ability, callback: AbilityCallback): boolean {
		if (!this.abilities[ability]) {
			this.abilities[ability] = [];
		}

		this.abilities[ability]?.push(callback);

		// Just in case we want this function to ever fail, we make it return success.
		return true;
	}

	// Keywords

	hasKeyword(keyword: Keyword): boolean {
		return Object.keys(this.keywords).includes(keyword);
	}

	/**
	 * Adds a keyword to the card
	 *
	 * @param keyword The keyword to add
	 *
	 * @returns Success
	 */
	addKeyword(keyword: Keyword, info?: unknown): boolean {
		if (this.hasKeyword(keyword)) {
			return false;
		}

		this.keywords[keyword] = info;

		switch (keyword) {
			case Keyword.Charge: {
				this.ready();

				break;
			}

			case Keyword.Rush: {
				this.ready();
				this.canAttackHero = false;

				break;
			}

			case Keyword.CantAttack: {
				this.sleepy = true;

				break;
			}

			case Keyword.UnlimitedAttacks: {
				this.ready();
				this.resetAttackTimes();

				if (this.owner.weapon === this) {
					this.owner.canAttack = true;
				}

				break;
			}

			default: {
				break;
			}
		}

		return true;
	}

	/**
	 * Adds a keyword to the card
	 *
	 * @param keyword The keyword to add
	 *
	 * @returns Success
	 */
	remKeyword(keyword: Keyword): boolean {
		if (!this.hasKeyword(keyword)) {
			return false;
		}

		delete this.keywords[keyword];

		return true;
	}

	/**
	 * Gets the information stored in a keyword
	 *
	 * @returns The info
	 */
	getKeyword(keyword: Keyword): unknown | false {
		if (!this.hasKeyword(keyword)) {
			return false;
		}

		return this.keywords[keyword];
	}

	/**
	 * Sets the information stored in a keyword. RETURNS FALSE IF THIS CARD DOESN'T ALREADY HAVE THIS KEYWORD.
	 *
	 * @returns Success
	 */
	setKeyword(keyword: Keyword, info: unknown): boolean {
		if (!this.hasKeyword(keyword)) {
			return false;
		}

		this.keywords[keyword] = info;

		return true;
	}

	/**
	 * Freeze the card.
	 * Broadcasts the `FreezeCard` event.
	 *
	 * @returns Success
	 */
	freeze(): boolean {
		this.addKeyword(Keyword.Frozen);

		game.event.broadcast(Event.FreezeCard, this, this.owner);

		return true;
	}

	/**
	 * Mark a card as having attacked once, and if it runs out of attacks this turn, exhaust it.
	 *
	 * @returns Success
	 */
	decAttack(): boolean {
		if (!this.attackTimes) {
			return false;
		}

		if (this.hasKeyword(Keyword.UnlimitedAttacks)) {
			return false;
		}

		this.attackTimes--;

		const shouldExhaust = this.attackTimes <= 0;
		if (shouldExhaust) {
			this.sleepy = true;
		}

		return true;
	}

	/**
	 * Makes this minion ready for attack. Use this instead of `sleepy = false`.
	 *
	 * You might have to run `resetAttackTimes` after this if you want the card to be able to attack again. Be careful with that.
	 *
	 * @returns Success
	 */
	ready(): boolean {
		/*
		 * If the card can't attack, prevent it from being ready
		 * This will show the card as being "Exhausted" when you play it which is not exactly correct, but it's fine for now
		 */
		if (this.hasKeyword(Keyword.CantAttack)) {
			return false;
		}

		this.sleepy = false;

		return true;
	}

	// Change stats

	/**
	 * Sets the card's attack and health.
	 *
	 * @param attack The attack to set
	 * @param health The health to set
	 * @param changeMaxHealth If the card's max health should be reset to it's current health if the health increases from running this function.
	 *
	 * @returns Success
	 */
	setStats(
		attack: number | undefined = this.attack,
		health: number | undefined = this.health,
		changeMaxHealth = true,
	): boolean {
		if (this.attack === undefined || this.health === undefined) {
			return false;
		}

		this.attack = attack;
		this.health = health;

		if (changeMaxHealth) {
			this.resetMaxHealth(false);
		}

		game.killCardsOnBoard();

		return true;
	}

	/**
	 * Adds `attack` and `health` to the card.
	 *
	 * @param attack The attack to add
	 * @param health The health to add
	 *
	 * @returns Success
	 */
	addStats(attack = 0, health = 0): boolean {
		if (this.attack === undefined || this.health === undefined) {
			return false;
		}

		this.attack += attack;
		this.addHealth(health, false);

		return true;
	}

	/**
	 * Removes `attack` and `health` from the card.
	 *
	 * @param attack The attack to remove
	 * @param health The health to remove
	 *
	 * @returns Success
	 */
	remStats(attack = 0, health = 0): boolean {
		if (this.attack === undefined || this.health === undefined) {
			return false;
		}

		this.attack -= attack;
		this.remHealth(health);

		return true;
	}

	/**
	 * Adds `amount` to the card's health
	 *
	 * @param amount The health to add
	 * @param restore Should reset health to it's max health if it goes over it's max health
	 *
	 * @returns Success
	 */
	addHealth(amount: number, restore = true): boolean {
		if (this.health === undefined) {
			return false;
		}

		const before = this.health;
		this.health += amount;

		if (!restore) {
			this.resetMaxHealth(true);
			return true;
		}

		// Restore health

		if (this.maxHealth && this.health > this.maxHealth) {
			// Too much health

			// Overheal keyword
			this.activate(Ability.Overheal);

			this.health = this.maxHealth ?? -1;

			if (this.health > before) {
				game.event.broadcast(Event.HealthRestored, this.maxHealth, this.owner);
			}
		} else if (this.health > before) {
			game.event.broadcast(Event.HealthRestored, this.health, this.owner);
		}

		return true;
	}

	/**
	 * Damages a card.
	 *
	 * Doesn't damage the card if it is a location card, is immune, or has Stealth.
	 *
	 * @param amount The health to remove
	 *
	 * @returns Success
	 */
	remHealth(amount: number): boolean {
		if (this.health === undefined) {
			return false;
		}

		// Don't allow location cards to be damaged
		if (this.type === Type.Location) {
			return false;
		}

		if (this.hasKeyword(Keyword.Stealth)) {
			return false;
		}

		if (this.hasKeyword(Keyword.Immune)) {
			return true;
		}

		this.setStats(this.attack, this.health - amount);
		game.event.broadcast(Event.DamageCard, [this, amount], this.owner);

		if (this.type === Type.Weapon && !this.isAlive()) {
			this.owner.destroyWeapon();
		}

		game.killCardsOnBoard();

		return true;
	}

	/**
	 * Sets the max health of the card to it's current health. If check is true it only sets the max health if the current health is above it.
	 *
	 * @param check Prevent lowering it's max health
	 *
	 * @returns If it reset the card's max health.
	 */
	resetMaxHealth(check = false): boolean {
		if (this.health === undefined) {
			return false;
		}

		if (!this.maxHealth) {
			return false;
		}

		if (check && this.health <= this.maxHealth) {
			return false;
		}

		this.maxHealth = this.health;
		return true;
	}

	// Set other

	/**
	 * Sets stealth to only last `duration` amount of turns
	 *
	 * @param duration The amount of turns stealth should last
	 *
	 * @returns Success.
	 */
	setStealthDuration(duration: number): boolean {
		this.stealthDuration = game.turn + duration;

		return true;
	}

	/**
	 * Sets the attack times of a card to;
	 * 1 if doesn't have windfury,
	 * 2 if it does,
	 * 4 if it has mega-windfury.
	 *
	 * @returns Success
	 */
	resetAttackTimes(): boolean {
		this.attackTimes = 1;

		if (this.hasKeyword(Keyword.Windfury)) {
			this.attackTimes = 2;
		}

		if (this.hasKeyword(Keyword.MegaWindfury)) {
			this.attackTimes = 4;
		}

		return true;
	}

	/**
	 * @returns If this card can attack.
	 */
	canAttack(): boolean {
		if (this.type === Type.Weapon) {
			return (this.attackTimes ?? 0) > 0;
		}

		if (this.type !== Type.Minion) {
			return false;
		}

		if (this.getKeyword(Keyword.Titan) as number[] | false) {
			// The card still has titan cards
			return false;
		}

		const booleans =
			!this.sleepy &&
			!this.hasKeyword(Keyword.Frozen) &&
			!this.hasKeyword(Keyword.Dormant) &&
			!this.hasKeyword(Keyword.CantAttack);
		const numbers = (this.attack ?? 0) > 0 && (this.attackTimes ?? 0) > 0;

		return booleans && numbers;
	}

	/**
	 * @returns If this card can be attacked
	 */
	canBeAttacked(): boolean {
		return (
			!this.hasKeyword(Keyword.Dormant) &&
			!this.hasKeyword(Keyword.Immune) &&
			!this.hasKeyword(Keyword.Stealth)
		);
	}

	/**
	 * Create a backup of the card.
	 *
	 * @returns The key of the backup. You can use it by doing `card.backups[key]`
	 */
	createBackup(): number {
		const index = Object.keys(this.backups).length;

		for (const entry of Object.entries(this)) {
			// HACK: Never usage
			this.backups[index][entry[0] as never] = entry[1] as never;
		}

		return index;
	}

	/**
	 * Restore a backup of the card.
	 *
	 * @param backup The backup to restore. It is recommended to supply a backup from `card.backups`.
	 *
	 * @returns Success
	 */
	restoreBackup(backup: CardBackup): boolean {
		for (const key of Object.keys(backup)) {
			// HACK: Never usage
			this[key as never] = backup[key as keyof Card] as never;
		}

		return true;
	}

	/**
	 * Bounces the card to the `player`'s hand.
	 *
	 * @param player
	 */
	bounce(player: Player = this.owner): boolean {
		this.owner = player;
		player.addToHand(this.perfectCopy());
		this.destroy();
		return true;
	}

	// Doom buttons

	/**
	 * Kills the card.
	 *
	 * @returns Success
	 */
	kill(): boolean {
		this.setStats(this.attack, 0);
		game.killCardsOnBoard();
		return true;
	}

	/**
	 * Silences the card.
	 *
	 * @returns Success
	 */
	silence(): boolean {
		/*
		 * Tell the minion to undo it's passive.
		 * The false tells the minion that this is the last time it will call remove
		 * so it should finish whatever it is doing.
		 */
		const removeReturn = this.activate(Ability.Remove, "SilenceCard");

		// If the remove function returned false, then we should not silence.
		if (Array.isArray(removeReturn) && removeReturn[0] === false) {
			return false;
		}

		// Remove abilities from the card.
		for (const ability of Object.keys(this.abilities)) {
			this.abilities[ability as Ability] = [];
		}

		for (const key of Object.keys(this)) {
			if (
				key === "health" &&
				(this.health ?? 0) < (this.backups.init.health ?? 0)
			) {
				continue;
			}

			if (key === "sleepy" || key === "attackTimes") {
				continue;
			}

			/*
			 * Check if a backup exists for the attribute. If it does; restore it.
			 * HACK: Never usage
			 */
			if (this.backups.init[key as never]) {
				this[key as never] = this.backups.init[key as never];
			} else if (this.blueprint[key as never]) {
				/*
				 * Check if the attribute if defined in the blueprint. If it is; restore it.
				 * HACK: Never usage
				 */
				this[key as never] = this.blueprint[key as never];
			}
		}

		// Don't strikethrough the text if the card doesn't have text (e.g. Sheep)
		if (this.text) {
			this.text = `<strikethrough>${this.text}</strikethrough>`;
		}

		this.keywords = {};

		// Remove active enchantments.
		this.applyEnchantments();

		game.event.broadcast(Event.SilenceCard, this, this.owner);

		game.killCardsOnBoard();
		return true;
	}

	/**
	 * Silences, then kills the card.
	 */
	destroy(): void {
		this.silence();
		this.kill();
	}

	/**
	 * Resets this card to its original state.
	 */
	reset(): void {
		// Silence it to remove any new abilities
		game.functions.event.withSuppressed(Event.SilenceCard, () =>
			this.silence(),
		);
		this.restoreBackup(this.backups.init);
	}

	/**
	 * Reloads this card. This will set the card's state to the default one from its blueprint.
	 *
	 * If the blueprint has changed since the last time it was loaded, it will apply the new blueprint to this card.
	 *
	 * Run this after having reloaded the blueprints to apply the new changes to this card.
	 */
	reload(): void {
		this.reset();
		this.doBlueprint();
	}

	// Handling functions

	/**
	 * Activates an ability
	 *
	 * @param name The method to activate
	 * @param key The key of the event. ONLY PASS THIS IN PASSIVE, REMOVE, OR TICK ABILITIES.
	 * @param _unknownValue The raw value of the event. ONLY PASS THIS IN PASSIVE, REMOVE, OR TICK ABILITIES.
	 * @param eventPlayer The player who caused the event. ONLY PASS THIS IN PASSIVE, REMOVE, OR TICK ABILITIES.
	 *
	 * @returns All the return values of the method keywords
	 */
	activate(
		name: Ability,
		key?: Event | string | undefined,
		_unknownValue?: UnknownEventValue,
		eventPlayer?: Player,
	): unknown[] | -1 | false {
		/*
		 * This activates a function
		 * Example: activate("cast")
		 * Do: this.cast.forEach(castFunc => castFunc(owner, card))
		 * Returns a list of the return values from all the function calls
		 */
		const ability: AbilityCallback[] | undefined = this.abilities[name];

		// If the card has the function
		if (!ability) {
			return false;
		}

		let returnValue: unknown[] | -1 = [];

		for (const callback of ability) {
			if (returnValue === Card.REFUND) {
				continue;
			}

			const result = callback(
				this.owner,
				this,
				key as Event,
				_unknownValue,
				eventPlayer,
			);
			if (Array.isArray(returnValue)) {
				returnValue.push(result);
			}

			// Deathrattle isn't cancellable
			if (result !== Card.REFUND || name === Ability.Deathrattle) {
				continue;
			}

			// If the return value is -1, meaning "refund", refund the card and stop the for loop
			game.event.broadcast(Event.CancelCard, [this, name], this.owner);

			returnValue = Card.REFUND;

			// These abilities shouldn't "refund" the card, just stop execution.
			if (["use", "heropower"].includes(name)) {
				continue;
			}

			/*
			 * We have to suppress inside the loop in order to not have the event suppressed when calling the ability
			 * It's a bit hacky, and not very efficient, but it works
			 */
			game.functions.event.withSuppressed(Event.AddCardToHand, () =>
				this.owner.addToHand(this),
			);

			this.owner[this.costType] += this.cost;

			// Return from the for loop
		}

		return returnValue;
	}

	/**
	 * @param m The mana to test
	 *
	 * @returns Manathirst for `m`
	 */
	manathirst(m: number): boolean {
		return this.owner.emptyMana >= m;
	}

	/**
	 * Discards this card from a player's hand.
	 * Broadcasts the `DiscardCard` event if the card was successfully discarded.
	 *
	 * @param player The player to discard the card from. Defaults to the card's owner
	 *
	 * @returns If the card was successfully discarded
	 */
	discard(player = this.owner): boolean {
		const returnValue = game.functions.util.remove(player.hand, this);

		if (returnValue) {
			game.event.broadcast(Event.DiscardCard, this, player);
		}

		return returnValue;
	}

	/**
	 * Checks if the condition is met, and if it is, adds `(Condition cleared!)` to the description
	 *
	 * @returns If the condition is met
	 */
	condition(): boolean {
		const clearedText = " <bright:green>(Condition cleared!)</bright:green>";
		const clearedTextAlternative =
			"<bright:green>Condition cleared!</bright:green>";

		// Remove the (Condition cleared!) from the description
		this.text = this.text.replace(clearedText, "");
		this.text = this.text.replace(clearedTextAlternative, "");

		// Check if the condition is met
		const condition = this.activate(Ability.Condition);
		if (!Array.isArray(condition) || condition[0] === false) {
			return false;
		}

		// Add the (Condition cleared!) to the description
		this.text += this.text ? clearedText : clearedTextAlternative;

		return true;
	}

	/**
	 * Get information from an enchantment.
	 *
	 * @param enchantment The enchantment string
	 *
	 * @example
	 * const info = getEnchantmentInfo("cost = 1");
	 * assert.equal(info, {"key": "cost", "val": "1", "op": "="});
	 *
	 * @returns The info
	 */
	getEnchantmentInfo(enchantment: string): {
		key: string;
		val: string;
		op: string;
	} {
		const equalsRegex = /\w+ = \w+/;
		const otherRegex = /[-+*/^]\d+ \w+/;

		const opEquals = equalsRegex.test(enchantment);
		const opOther = otherRegex.test(enchantment);

		let key = "undefined";
		let value = "undefined";
		let op = "=";

		if (opEquals) {
			[key, value] = enchantment.split(" = ");
		} else if (opOther) {
			[value, key] = enchantment.split(" ");
			value = value.slice(1);

			op = enchantment[0];
		}

		return { key, val: value, op };
	}

	/**
	 * Runs through this card's enchantments list and applies each enchantment in order.
	 *
	 * @returns Success
	 */
	applyEnchantments(): boolean {
		// Don't waste resources if this card doesn't have any enchantments, this gets called every tick after all.
		if (this.enchantments.length <= 0) {
			return false;
		}

		// Apply baseline for int values.
		const allowedKeys = new Set(["maxHealth", "cost"]);

		let entries = Object.entries(this);
		// Filter for only numbers
		entries = entries.filter((c) => typeof c[1] === "number");

		// Filter for vars in the whitelist
		entries = entries.filter((c) => allowedKeys.has(c[0]));

		// Get a list of enchantments
		const enchantments = this.enchantments.map(
			(enchantment) => enchantment.enchantment,
		);

		// Get keys
		const keys = new Set(
			enchantments.map(
				(enchantment) => this.getEnchantmentInfo(enchantment).key,
			),
		);

		// Only reset the variables if the variable name is in the enchantments list
		entries = entries.filter((c) => keys.has(c[0]));
		for (const entry of entries) {
			const [key] = entry;

			// Apply backup if it exists, otherwise keep it the same.
			if (this.backups.init ? [key] : false) {
				// HACK: Never usage
				this[key as never] = this.backups.init[key as never];
			}
		}

		for (const enchantmentObject of this.enchantments) {
			const { enchantment } = enchantmentObject;

			// Seperate the keys and values
			const info = this.getEnchantmentInfo(enchantment);
			const [anyKey, value, operation] = Object.values(info);

			const key = anyKey as keyof this;

			const numberValue = game.lodash.parseInt(value);
			if (typeof this[key] !== "number") {
				continue;
			}

			switch (operation) {
				case "=": {
					(this[key] as number) = numberValue;
					break;
				}

				case "+": {
					(this[key] as number) += numberValue;
					break;
				}

				case "-": {
					(this[key] as number) -= numberValue;
					break;
				}

				case "*": {
					(this[key] as number) *= numberValue;
					break;
				}

				case "/": {
					(this[key] as number) /= numberValue;
					break;
				}

				case "^": {
					(this[key] as number) = (this[key] as number) ** numberValue;
					break;
				}

				default: {
					break;
				}
			}
		}

		return true;
	}

	/**
	 * Add an enchantment to the card. The enchantments look something like this: `cost = 1`, `+1 cost`, `-1 cost`.
	 *
	 * @param enchantment The enchantment string
	 * @param owner The creator of the enchantment. This will allow removing or looking up enchantment later.
	 *
	 * @returns Success
	 */
	addEnchantment(enchantment: string, owner: Card): boolean {
		const info = this.getEnchantmentInfo(enchantment);

		// Add the enchantment to the beginning of the list, equal enchantments should apply first
		if (info.op === "=") {
			this.enchantments.unshift({ enchantment, owner });
		} else {
			this.enchantments.push({ enchantment, owner });
		}

		this.applyEnchantments();

		return true;
	}

	/**
	 * Checks if an enchantment exists.
	 *
	 * @param enchantment The enchantment to look for.
	 * @param card The owner of the enchantment. This needs to be correct to find the right enchantment.
	 * @see {@link addEnchantment} for more info about `card`.
	 *
	 * @returns If the enchantment exists
	 */
	enchantmentExists(enchantment: string, card: Card): boolean {
		return this.enchantments.some(
			(c) => c.enchantment === enchantment && c.owner === card,
		);
	}

	/**
	 * Removes an enchantment
	 *
	 * @param enchantmentString The enchantment to remove
	 * @param card The owner of the enchantment.
	 * @see {@link enchantmentExists} for more info about `card`.
	 * @param update Keep this enabled unless you know what you're doing.
	 *
	 * @returns Success
	 */
	removeEnchantment(
		enchantmentString: string,
		card: Card,
		update = true,
	): boolean {
		const enchantment = this.enchantments.find(
			(c) => c.enchantment === enchantmentString && c.owner === card,
		);
		if (!enchantment) {
			return false;
		}

		const index = this.enchantments.indexOf(enchantment);
		if (index === -1) {
			return false;
		}

		this.enchantments.splice(index, 1);

		if (!update) {
			this.applyEnchantments();
			return true;
		}

		// Update is enabled
		const info = this.getEnchantmentInfo(enchantmentString);
		const newEnchantment = `+0 ${info.key}`;

		// This will cause the variable to be reset since it is in the enchantments list.
		this.addEnchantment(newEnchantment, this);
		this.removeEnchantment(newEnchantment, this, false);

		return true;
	}

	/**
	 * Replaces the placeholders (`{placeholder}`) with a more technical format that the rest of the game can understand.
	 *
	 * @example
	 * card.text = "The current turn count is {turns}";
	 * card.placeholders = [(owner, self) => {
	 *     const turns = game.functions.util.getTraditionalTurnCounter();
	 *
	 *     return { turns };
	 * }];
	 * card.replacePlaceholders();
	 *
	 * // The `{ph:turns}` tag is replaced when displaying the card.
	 * assert.equal(card.text, "The current turn count is {ph:turns}");
	 *
	 * @returns Success
	 */
	replacePlaceholders(): boolean {
		if (!this.abilities.placeholders) {
			return false;
		}

		const temporaryPlaceholder = this.activate(Ability.Placeholders);
		if (!Array.isArray(temporaryPlaceholder)) {
			return false;
		}

		const placeholder = temporaryPlaceholder[0];
		if (!(placeholder instanceof Object)) {
			return false;
		}

		this.placeholder = placeholder as Record<string, string>;

		for (const placeholderObject of Object.entries(placeholder)) {
			const [key] = placeholderObject;
			this.text = this.text.replaceAll(`{${key}}`, `{ph:${key}}`);
		}

		return true;
	}

	/**
	 * Replaces placeholders in the description of this card.
	 *
	 * @param overrideText The description. If empty, it uses this card's description instead.
	 * @param _depth The depth of recursion.
	 *
	 * @returns The modified description with placeholders replaced.
	 */
	doPlaceholders(overrideText = "", _depth = 0): string {
		let reg = /{ph:(.*?)}/;

		let text = overrideText;
		if (!overrideText) {
			text = this.text || "";
		}

		let running = true;
		while (running) {
			const regedDesc = reg.exec(text);

			// There is nothing more to extract
			if (!regedDesc) {
				running = false;
				break;
			}

			// Get the capturing group result
			const key = regedDesc[1];

			this.replacePlaceholders();
			const rawReplacement = this.placeholder;
			if (!rawReplacement) {
				throw new Error("Card placeholder not found.");
			}

			let replacement = rawReplacement[key] as string | Card;

			if (replacement instanceof Card) {
				// The replacement is a card
				const onlyShowName =
					game.config.advanced.getReadableCardNoRecursion ||
					!game.player.detailedView;

				const alwaysShowFullCard =
					game.config.advanced.getReadableCardAlwaysShowFullCard;

				replacement =
					onlyShowName && !alwaysShowFullCard
						? replacement.colorFromRarity()
						: replacement.readable(-1, _depth + 1);
			}

			text = game.functions.color.fromTags(text.replace(reg, replacement));
		}

		// Replace spell damage placeholders
		reg = /\$(\d+)/;

		running = true;
		while (running) {
			const regedDesc = reg.exec(text);
			if (!regedDesc) {
				running = false;
				break;
			}

			// Get the capturing group result
			const key = regedDesc[1];
			const replacement = game.lodash.parseInt(key) + game.player.spellDamage;

			text = text.replace(reg, replacement.toString());
		}

		return text;
	}

	/**
	 * Return a perfect copy of this card. This will perfectly clone the card. This happens when, for example, a card gets temporarily removed from the board using card.destroy, then put back on the board.
	 *
	 * @example
	 * const cloned = card.perfectCopy();
	 *
	 * // This will actually fail since they're slightly different, but you get the point
	 * assert.equal(cloned, card);
	 *
	 * @returns A perfect copy of this card.
	 */
	perfectCopy(): this {
		const clone = game.lodash.clone(this);

		clone.randomizeUUID();
		clone.sleepy = true;
		clone.turn = game.turn;

		return clone;
	}

	/**
	 * Return an imperfect copy of this card. This happens when, for example, a card gets shuffled into your deck in vanilla Hearthstone.
	 *
	 * @example
	 * const cloned = card.imperfectCopy();
	 * const cloned2 = game.createCard(card.id, card.owner);
	 *
	 * // This will actually fail since they're slightly different, but you get the point
	 * assert.equal(cloned, cloned2);
	 *
	 * @returns An imperfect copy of this card.
	 */
	imperfectCopy(): Card {
		return new Card(this.id, this.owner);
	}

	/**
	 * @returns If the card specified has the ability to appear on the board.
	 */
	canBeOnBoard(): boolean {
		return this.type === Type.Minion || this.type === Type.Location;
	}

	/**
	 * @returns If this card has stats
	 */
	hasStats(): boolean {
		return this.type === Type.Minion || this.type === Type.Weapon;
	}

	/**
	 * @returns If this card is alive
	 */
	isAlive(): boolean {
		if (this.health !== undefined) {
			return this.health > 0;
		}

		if (this.durability !== undefined) {
			return this.durability > 0;
		}

		return false;
	}

	/**
	 * Checks if this card is a valid card to put into its players deck
	 *
	 * @returns Success | Errorcode
	 */
	validateForDeck(): true | "class" | "uncollectible" | "runes" {
		if (!this.classes.includes(this.owner.heroClass)) {
			// If it is a neutral card, it is valid
			if (this.classes.includes(Class.Neutral)) {
				// Valid
			} else {
				return "class";
			}
		}

		if (!this.collectible) {
			return "uncollectible";
		}

		// Runes
		if (this.runes && !this.owner.testRunes(this.runes)) {
			return "runes";
		}

		return true;
	}

	/**
	 * Asks the user a `prompt` and show 3 choices for the player to choose, and do something to the minion based on the choice.
	 *
	 * @param prompt The prompt to ask the user
	 * @param _values DON'T TOUCH THIS UNLESS YOU KNOW WHAT YOU'RE DOING
	 *
	 * @returns An array with the name of the adapt(s) chosen, or -1 if the user cancelled.
	 */
	adapt(prompt = "Choose One:", _values: string[][] = []): string | -1 {
		game.interact.info.showGame(game.player);

		const possibleCards = [
			["Crackling Shield", "Divine Shield"],
			["Flaming Claws", "+3 Attack"],
			["Living Spores", "Deathrattle: Summon two 1/1 Plants."],
			["Lightning Speed", "Windfury"],
			["Liquid Membrane", "Can't be targeted by spells or Hero Powers."],
			["Massive", "Taunt"],
			["Volcanic Might", "+1/+1"],
			["Rocky Carapace", "+3 Health"],
			["Shrouding Mist", "Stealth until your next turn."],
			["Poison Spit", "Poisonous"],
		];
		const values = _values;

		if (values.length === 0) {
			for (let i = 0; i < 3; i++) {
				const card = game.lodash.sample(possibleCards);
				if (!card) {
					throw new Error("undefined when randomly choosing adapt option");
				}

				values.push(card);
				game.functions.util.remove(possibleCards, card);
			}
		}

		let p = `\n${prompt}\n[\n`;

		for (const [index, value] of values.entries()) {
			// Check for a TypeError and ignore it
			try {
				p += `${index + 1}: ${value[0]}; ${value[1]},\n`;
			} catch {}
		}

		p = p.slice(0, -2);
		p += "\n] ";

		let choice = game.input(p);
		if (!game.lodash.parseInt(choice)) {
			game.pause("<red>Invalid choice!</red>\n");
			return this.adapt(prompt, values);
		}

		if (game.lodash.parseInt(choice) > 3) {
			return this.adapt(prompt, values);
		}

		choice = values[game.lodash.parseInt(choice) - 1][0];

		switch (choice) {
			case "Crackling Shield": {
				this.addKeyword(Keyword.DivineShield);
				break;
			}

			case "Flaming Claws": {
				this.addStats(3, 0);
				break;
			}

			case "Living Spores": {
				this.addAbility(Ability.Deathrattle, (owner, _) => {
					owner.summon(new Card(game.cardIds.plant3, owner));
					owner.summon(new Card(game.cardIds.plant3, owner));
				});
				break;
			}

			case "Lightning Speed": {
				this.addKeyword(Keyword.Windfury);
				break;
			}

			case "Liquid Membrane": {
				this.addKeyword(Keyword.Windfury);
				break;
			}

			case "Massive": {
				this.addKeyword(Keyword.Taunt);
				break;
			}

			case "Volcanic Might": {
				this.addStats(1, 1);
				break;
			}

			case "Rocky Carapace": {
				this.addStats(0, 3);
				break;
			}

			case "Shrouding Mist": {
				this.addKeyword(Keyword.Stealth);
				this.setStealthDuration(1);
				break;
			}

			case "Poison Spit": {
				this.addKeyword(Keyword.Poisonous);
				break;
			}

			default: {
				break;
			}
		}

		return choice;
	}

	/**
	 * Bumps the invoke count for a card.
	 *
	 * @param storageName The name where the info is stored. I recommend "invokeCount". You can get that information from `card.storage[storageName]` afterwards.
	 */
	galakrondBump(storageName: string): void {
		if (!this.storage[storageName]) {
			this.storage[storageName] = 0;
		}

		if (this.storage[storageName] >= 3) {
			this.storage[storageName] = 3;
		}

		this.storage[storageName]++;
	}

	/**
	 * Decrements the infuse count by 1.
	 * Activates the card's infuse ability if the infuse count is 0.
	 *
	 * @returns Success
	 */
	tryInfuse(): boolean {
		const infuse = this.getKeyword(Keyword.Infuse) as number | undefined;
		if (!infuse || infuse <= 0) {
			return false;
		}

		const newInfuse = infuse - 1;

		this.setKeyword(Keyword.Infuse, newInfuse);
		if (newInfuse > 0) {
			return false;
		}

		this.activate(Ability.Infuse);
		return true;
	}

	/**
	 * @param text The text to add the the color to. Defaults to this card's name
	 */
	colorFromRarity(text = this.name): string {
		return game.functions.color.fromRarity(text, this.rarity);
	}

	/**
	 * @param length How many characters of the UUID to return
	 *
	 * @returns A colored version of the card's UUID.
	 */
	coloredUUID(length = 7): string {
		return game.functions.color.fromTags(
			`<#${this.uuid.slice(0, 6)}>${this.uuid.slice(0, length)}</#>`,
		);
	}

	/**
	 * Takes control of the card by changing its owner.
	 *
	 * @param newOwner The new owner of the card.
	 */
	takeControl(newOwner: Player): void {
		game.functions.util.remove(this.owner.board, this);

		this.owner = newOwner;
		newOwner.summon(this);
	}

	/**
	 * Makes this card attack a minion or hero
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
	 * Returns this card in a human readable state. If you "console.log" the result of this, the user will get all the information they need from this card.
	 *
	 * @param i If this is set, this function will add `[i]` to the beginning of the string. This is useful if there are many different cards to choose from.
	 * @param _depth The depth of recursion. DO NOT SET THIS MANUALLY.
	 *
	 * @returns The human readable card string
	 */
	readable(i = -1, _depth = 0): string {
		const { branch } = game.functions.info.version();

		/**
		 * If it should show detailed errors regarding depth.
		 */
		const showDetailedError: boolean =
			game.config.general.debug ||
			branch !== "stable" ||
			game.player.detailedView;

		if (_depth > 0 && game.config.advanced.getReadableCardNoRecursion) {
			if (showDetailedError) {
				return "RECURSION ATTEMPT BLOCKED";
			}

			return "...";
		}

		if (_depth > game.config.advanced.getReadableCardMaxDepth) {
			if (showDetailedError) {
				return "MAX DEPTH REACHED";
			}

			return "...";
		}

		let sb = "";

		let text = (this.text || "").length > 0 ? ` (${this.text}) ` : " ";

		// Extract placeholder value, remove the placeholder header and footer
		if (this.placeholder ?? /\$(\d+)/.test(this.text || "")) {
			text = this.doPlaceholders(text, _depth);
		}

		let cost = `{${this.cost}} `;

		switch (this.costType) {
			case CostType.Mana: {
				cost = `<cyan>${cost}</cyan>`;
				break;
			}

			case CostType.Armor: {
				cost = `<gray>${cost}</gray>`;
				break;
			}

			case CostType.Health: {
				cost = `<red>${cost}</red>`;
				break;
			}

			default: {
				break;
			}
		}

		const { name } = this;

		if (i !== -1) {
			sb += `[${i}] `;
		}

		sb += cost;
		sb += this.colorFromRarity(name);

		if (game.config.general.debug) {
			const idHex = (this.id + 1000).toString(16).repeat(6).slice(0, 6);
			sb += ` (#<#${idHex}>${this.id}</#> @${this.coloredUUID()})`;
		}

		if (this.hasStats()) {
			const titan = this.getKeyword(Keyword.Titan) as number[] | false;

			sb += titan
				? game.functions.color.if(
						!this.sleepy,
						"bright:green",
						` [${titan.length} Abilities Left]`,
					)
				: game.functions.color.if(
						this.canAttack(),
						"bright:green",
						` [${this.attack} / ${this.health}]`,
					);
		} else if (this.type === Type.Location) {
			const { durability } = this;
			const maxDurability = this.backups.init.durability;
			const maxCooldown = this.backups.init.cooldown ?? 0;

			sb += ` {<bright:green>Durability: ${durability} / ${maxDurability}</bright:green>,`;
			sb += ` <cyan>Cooldown: ${this.cooldown} / ${maxCooldown}</cyan>}`;
		}

		sb += text;
		sb += `<yellow>(${this.type})</yellow>`;

		// Add the keywords
		sb += Object.keys(this.keywords)
			.map((keyword) => ` <gray>{${keyword}}</gray>`)
			.join("");

		return sb;
	}

	/**
	 * Shows information from this card, "console.log"'s it and waits for the user to press enter. See `readable`.
	 *
	 * @param help If it should show a help message which displays what the different fields mean.
	 */
	view(help = true): void {
		const cardInfo = this.readable();
		const classInfo = `<gray>${this.classes.join(" / ")}</gray>`;

		let tribe = "";
		let spellSchool = "";
		let locCooldown = "";

		const { type } = this;

		switch (type) {
			case Type.Minion: {
				tribe = ` (<gray>${this.tribe ?? "None"}</gray>)`;
				break;
			}

			case Type.Spell: {
				spellSchool = this.spellSchool
					? ` (<cyan>${this.spellSchool}</cyan>)`
					: " (None)";
				break;
			}

			case Type.Location: {
				locCooldown = ` (<cyan>${this.storage.init.cooldown ?? 0}</cyan>)`;
				break;
			}

			case Type.Hero:
			case Type.Weapon:
			case Type.HeroPower:
			case Type.Undefined: {
				break;
			}

			// No default
		}

		if (help) {
			console.log(
				"<cyan>{cost}</cyan> <b>Name</b> (<bright:green>[attack / health]</bright:green> if is has) (description) <yellow>(type)</yellow> ((tribe) or (spell class) or (cooldown)) <gray>[class]</gray>",
			);
		}

		console.log(
			`${cardInfo + (tribe || spellSchool || locCooldown)} [${classInfo}]`,
		);

		console.log();
		game.pause();
	}
}
