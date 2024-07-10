// Created by the Vanilla Card Creator

import assert from "node:assert";
import { Card, Player } from "@Game/internal.js";
import type { Blueprint } from "@Game/types.js";

export const blueprint: Blueprint = {
	name: "Yogg-Saron, Master of Fate",
	text: "<b>Battlecry:</b> If you've cast 10 spells this game, spin the Wheel of Yogg-Saron.{left}",
	cost: 10,
	type: "Minion",
	classes: ["Neutral"],
	rarity: "Legendary",
	collectible: true,
	id: 104,

	attack: 7,
	health: 5,
	tribe: "None",

	battlecry(owner, self) {
		// If you've cast 10 spells this game, spin the Wheel of Yogg-Saron. ({amount} left!)
		if (!self.condition()) {
			return;
		}

		const choices = [
			"Curse of Flesh",
			"Devouring Hunger",
			"Hand of Fate",
			"Mindflayer Goggles",
			"Mysterybox",
			"Rod of Roasting",
		];
		const choice = game.lodash.sample(choices);
		if (!choice) {
			throw new Error("No choice found");
		}

		const pool = Card.all();

		const minionPool = pool.filter((card) => card.type === "Minion");
		const spellPool = pool.filter((card) => card.type === "Spell");

		switch (choice) {
			case "Curse of Flesh": {
				// Fill the board with random minions, then give yours Rush.
				for (let id = 0; id < 2; id++) {
					const player = Player.fromID(id);

					// Subtract to account for yogg-saron being on the board
					const remaining =
						player.getRemainingBoardSpace() - (player === owner ? 1 : 0);

					for (let index = 0; index < remaining; index++) {
						const card = game.lodash.sample(minionPool)?.imperfectCopy();
						if (!card) {
							continue;
						}

						if (player === owner) {
							card.addKeyword("Rush");
						}

						player.summon(card);
					}
				}

				break;
			}

			case "Devouring Hunger": {
				// Destroy all other minions. Gain their Attack and Health.
				for (const player of [game.player1, game.player2]) {
					for (const card of player.board) {
						if (card === self) {
							continue;
						}

						card.kill();
						self.addStats(card.attack, card.health);
					}
				}

				break;
			}

			case "Hand of Fate": {
				// Fill your hand with random spells. They cost (0) this turn.
				const remaining = owner.getRemainingHandSpace();

				for (let index = 0; index < remaining; index++) {
					const card = game.lodash.sample(spellPool)?.imperfectCopy();
					if (!card) {
						continue;
					}

					card.addEnchantment("cost = 0", self);
					owner.addToHand(card);
				}

				game.functions.event.addListener("EndTurn", () => {
					for (const card of owner.hand) {
						card.removeEnchantment("cost = 0", self);
					}

					return "destroy";
				});

				break;
			}

			case "Mindflayer Goggles": {
				// Take control of three random enemy minions.
				const board = owner.getOpponent().board;

				for (let index = 0; index < 3; index++) {
					const card = game.lodash.sample(board);
					if (!card) {
						continue;
					}

					card.takeControl(owner);
				}

				break;
			}

			case "Mysterybox": {
				// Cast a random spell for every spell you've cast this game (targets chosen randomly).
				const oldYogg = new Card(game.cardIds.yoggSaronHopesEnd103, owner);
				oldYogg.activate("battlecry");

				break;
			}

			case "Rod of Roasting": {
				// Cast 'Pyroblast' randomly until a hero dies.
				const rod = new Card(game.cardIds.pyroblast105, owner);

				while (game.player1.isAlive() && game.player2.isAlive()) {
					owner.forceTarget = game.functions.util.getRandomTarget();
					rod.activate("cast");
				}

				owner.forceTarget = undefined;

				break;
			}

			// No default
		}

		game.event.broadcast(Event.CardEvent, [self, choice], owner);
	},

	placeholders(owner, self) {
		const amount = game.event.events.PlayCard?.[owner.id].filter(
			(object) => object[0] instanceof Card && object[0].type === "Spell",
		).length;
		if (!amount) {
			return { left: " <i>(10 left!)</i>" };
		}

		if (amount >= 10) {
			return { left: "" };
		}

		return { left: ` <i>(${10 - amount} left!)</i>` };
	},

	condition(owner, self) {
		const amount = game.event.events.PlayCard?.[owner.id].filter(
			(object) => object[0] instanceof Card && object[0].type === "Spell",
		).length;
		if (!amount) {
			return false;
		}

		return amount >= 10;
	},

	test(owner, self) {
		// TODO: Add proper tests. #325
		return true;
	},
};
