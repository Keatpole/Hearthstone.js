import {type CardLike, type VanillaCard, type CardClass, type MinionTribe, type CardClassNoNeutral} from '@Game/types.js';
import {Card, CardError, type Player} from '../../internal.js';
import {doImportCards, generateCardExports} from '../../helper/cards.js';
import {validateBlueprint} from '../../helper/validator.js';

const vanilla = {
	/**
     * Returns all cards added to Vanilla Hearthstone.
     *
     * This will throw an error if the user has not run the vanilla card generator,
     *
     * @example
     * const vanillaCards = getAll();
     *
     * vanillaCards.forEach(vanillaCard => {
     *     game.log(vanillaCard.dbfId);
     * });
     *
     * @returns The vanilla cards
     */
	getAll(): VanillaCard[] {
		const fileLocation = '/vanillacards.json';
		if (game.functions.file.exists(fileLocation)) {
			return JSON.parse(game.functions.file.read(fileLocation)) as VanillaCard[];
		}

		throw new Error('Cards file not found! Run \'npm run script:vanilla:generator\' (requires an internet connection), then try again.');
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
	filter(cards: VanillaCard[], uncollectible = true, dangerous = false, keepHeroSkins = false): VanillaCard[] {
		if (uncollectible) {
			cards = cards.filter(a => a.collectible);
		}

		cards = cards.filter(a => !a.id.startsWith('Prologue'));

		// Idk what 'PVPDR' means, but ok
		cards = cards.filter(a => !a.id.startsWith('PVPDR'));
		cards = cards.filter(a => !a.id.startsWith('DRGA_BOSS'));

		// Battlegrounds
		cards = cards.filter(a => !a.id.startsWith('BG'));

		// Tavern Brawl
		cards = cards.filter(a => !a.id.startsWith('TB'));
		cards = cards.filter(a => !a.id.startsWith('LOOTA_'));
		cards = cards.filter(a => !a.id.startsWith('DALA_'));
		cards = cards.filter(a => !a.id.startsWith('GILA_'));
		cards = cards.filter(a => !a.id.startsWith('BOTA_'));
		cards = cards.filter(a => !a.id.startsWith('TRLA_'));
		cards = cards.filter(a => !a.id.startsWith('DALA_'));
		cards = cards.filter(a => !a.id.startsWith('ULDA_'));
		cards = cards.filter(a => !a.id.startsWith('BTA_BOSS_'));
		cards = cards.filter(a => !a.id.startsWith('Story_'));

		// Book of mercenaries
		cards = cards.filter(a => !a.id.startsWith('BOM_'));
		cards = cards.filter(a => !a.mechanics || !a.mechanics.includes('DUNGEON_PASSIVE_BUFF'));
		cards = cards.filter(a => !a.battlegroundsNormalDbfId);
		cards = cards.filter(a => a.set && !['battlegrounds', 'placeholder', 'vanilla', 'credits'].includes(a.set.toLowerCase()));
		cards = cards.filter(a => a.set && !a.set.includes('PLACEHOLDER_'));
		cards = cards.filter(a => !a.mercenariesRole);

		const filteredCards: VanillaCard[] = [];

		for (const a of cards) {
			// If the set is `HERO_SKINS`, only include it if it's id is `HERO_xx`, where the x's are a number.
			if (a.set && a.set.includes('HERO_SKINS')) {
				if (keepHeroSkins && /HERO_\d\d/.test(a.id)) {
					filteredCards.push(a);
				}

				continue;
			}

			filteredCards.push(a);
		}

		cards = filteredCards;

		if (dangerous) {
			// If any of the cards have a 'howToEarn' field, filter away any cards that don't have that
			const _cards = cards.filter(a => a.howToEarn);
			if (_cards.length > 0) {
				cards = _cards;
			}
		}

		return cards;
	},
};

export const cardFunctions = {
	/**
     * Vanilla card related functions
     */
	vanilla,

	/**
     * Returns the card with the name `name`.
     *
     * @param name The name
     * @param refer If this should call `getCardById` if it doesn't find the card from the name
     *
     * @returns The blueprint of the card
     */
	getFromName(name: string | number, refer = true): Card | undefined {
		let card;

		for (const c of this.getAll(false)) {
			if (typeof name === 'number') {
				continue;
			}

			if (c.name.toLowerCase() === name.toLowerCase()) {
				card = c;
			}
		}

		if (!card && refer) {
			card = this.getFromId(name, false);
		}

		return card;
	},

	/**
     * Returns the card with the id of `id`.
     *
     * @param id The id
     * @param refer If this should call `getCardByName` if it doesn't find the card from the id
     *
     * @returns The blueprint of the card
     */
	getFromId(id: number | string, refer = true): Card | undefined {
		const card = this.getAll(false).find(c => c.id === id);

		if (!card && refer) {
			return this.getFromName(id.toString(), false);
		}

		return card;
	},

	/**
     * Returns all cards added to Hearthstone.js
     *
     * @param uncollectible Filter out all uncollectible cards
     * @param cards This defaults to `game.cards`, which contains all cards in the game.
     *
     * @returns Cards
     */
	getAll(uncollectible = true): Card[] {
		if (game.cards.length <= 0) {
			game.cards = game.blueprints.map(card => new Card(card.name, game.player));
		}

		return game.cards.filter(c => !c.uncollectible || !uncollectible);
	},

	/**
     * Returns if `classes` includes `cardClass` (also Neutral logic).
     */
	validateClasses(classes: CardClass[], cardClass: CardClass): boolean {
		if (classes.includes('Neutral')) {
			return true;
		}

		return classes.includes(cardClass);
	},

	/**
     * Returns if the `cardTribe` is `tribe` or 'All'
     *
     * @param cardTribe
     * @param tribe
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
	matchTribe(cardTribe: MinionTribe, tribe: MinionTribe): boolean {
		// If the card's tribe is "All".
		if (/all/i.test(cardTribe)) {
			return true;
		}

		return cardTribe.includes(tribe);
	},

	/**
     * Validates the blueprints.
     *
     * @returns If one or more blueprints were found invalid.
     */
	runBlueprintValidator() {
		// Validate the cards
		let valid = true;
		for (const card of game.blueprints) {
			const errorMessage = validateBlueprint(card);

			// Success
			if (errorMessage === true) {
				continue;
			}

			// Validation error
			game.log(`<red>Card <bold>'${card.name}'</bold> is invalid since ${errorMessage}</red>`);
			valid = false;
		}

		return valid;
	},

	/**
     * Imports all cards from a folder
     *
     * @returns Success
     */
	importAll() {
		generateCardExports();
		doImportCards();

		if (!this.runBlueprintValidator()) {
			throw new Error('Some cards are invalid. Please fix these issues before playing.');
		}

		return true;
	},

	/**
     * Filters out all cards that are uncollectible in a list
     *
     * @param cards The list of cards
     *
     * @returns The cards without the uncollectible cards
     */
	accountForUncollectible(cards: CardLike[]): CardLike[] {
		return cards.filter(c => !c.uncollectible);
	},

	/**
     * Creates and returns a jade golem with the correct stats and cost for the player
     *
     * @param plr The jade golem's owner
     *
     * @returns The jade golem
     */
	createJade(plr: Player): Card {
		if (plr.jadeCounter < 30) {
			plr.jadeCounter += 1;
		}

		const count = plr.jadeCounter;
		const cost = (count < 10) ? count : 10;

		const jade = new Card('Jade Golem', plr);
		jade.setStats(count, count);
		jade.cost = cost;

		return jade;
	},

	/**
     * Returns all classes in the game
     *
     * @returns Classes
     *
     * @example
     * const classes = getClasses();
     *
     * assert.equal(classes, ["Mage", "Warrior", "Druid", ...])
     */
	getClasses(): CardClassNoNeutral[] {
		const classes: CardClassNoNeutral[] = [];

		for (const file of game.functions.file.directory.read('/cards/StartingHeroes')) {
			// Something is wrong with the file name.
			if (!file.name.endsWith('.ts')) {
				continue;
			}

			// Remove ".ts"
			let name = file.name.slice(0, -3);

			// Remove underscores
			name = name.replaceAll('_', ' ');

			// Capitalize all words
			name = game.functions.util.capitalizeAll(name);

			const card = this.getFromName(name + ' Starting Hero');
			if (!card || card.classes[0] !== name as CardClassNoNeutral || card.type !== 'Hero' || !card.abilities.heropower || card.classes.includes('Neutral')) {
				game.logWarn('Found card in the startingheroes folder that isn\'t a starting hero. If the game crashes, please note this in your bug report. Name: ' + name + '. Error Code: StartingHeroInvalidHandler');
				continue;
			}

			classes.push(card.classes[0]);
		}

		return classes;
	},

	/**
     * Returns the result of the galakrond formula
     *
     * @param invokeCount How many times that the card has been invoked. If this is not a number, this will throw an error.
     */
	galakrondFormula(invokeCount: any) {
		if (typeof invokeCount !== 'number') {
			throw new TypeError('invokeCount is not a number');
		}

		const x = invokeCount;
		const y = Math.ceil((x + 1) / 2) + Math.round(x * 0.15);

		return y || 1;
	},

	/**
     * Bumps the invoke count for a card.
     *
     * @param card The card. Just put in `self`.
     * @param storageName The name where the info is stored. I recommend "invokeCount". You can get that information from `card.storage[storageName]` afterwards.
     */
	galakrondBump(card: Card, storageName: string) {
		if (!card.storage[storageName]) {
			card.storage[storageName] = 0;
		}

		if (card.storage[storageName] >= 3) {
			card.storage[storageName] = 3;
		}

		card.storage[storageName]++;
	},

	createCardError(message: string) {
		return new CardError(message);
	},
};
