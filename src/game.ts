import { question }  from 'readline-sync';
import { functions, interact, Player, Card, AI } from "./internal.js";
import { Blueprint, EventKey, EventManagerEvents, EventValue, GameAttackReturn, GameConfig, GameConstants, GamePlayCardReturn, QuestType, Target, TickHookCallback } from "./types.js";

interface IEventManager {
    eventListeners: number;
    tickHooks: TickHookCallback[];
    history: {[x: number]: [[EventKey, EventValue<EventKey>, Player]]};
    events: EventManagerEvents;
    stats: {[key: string]: [number, number]};

    tick(key: EventKey, val: EventValue<EventKey>): boolean;
    cardUpdate(key: EventKey, val: EventValue<EventKey>): boolean;
    questUpdate(quests_name: "secrets" | "sidequests" | "quests", key: EventKey, val: EventValue<EventKey>, plr: Player): boolean;
    broadcast(key: EventKey, val: EventValue<EventKey>, plr: Player, updateHistory?: boolean): boolean;
    addHistory(key: EventKey, val: EventValue<EventKey>, plr: Player): void;
    broadcastDummy(plr: Player): boolean;
    increment(player: Player, key: string, amount?: number): number;
}

const eventManager: IEventManager = {
    /**
     * The amount of event listeners that have been added to the game, this never decreases.
     */
    eventListeners: 0,

    /**
     * The hooks that will be run when the game ticks.
     */
    tickHooks: [],

    /**
     * The history of the game.
     * 
     * It looks like this: `history[turn] = [[key, val, plr], ...]`
     */
    history: {},

    /**
     * Used like this:
     * ```ts
     * events[key] = {player1id: [[val1, turn], [val2, turn], [val3, turn], ...], player2id: [...]};
     * ```
     */
    events: {},

    stats: {},

    /**
     * Tick the game
     *
     * @param key The key of the event that triggered the tick
     * @param val The value of the event that triggered the tick
     */
    tick(key, val) {
        // The code in here gets executed very often
        let game = globalThis.game;
        if (!game) return false;

        // Infuse
        if (key == "KillMinion") {
            // Get the game from the properties
            val = val as EventValue<typeof key>;
            val.plr.hand.forEach(p => {
                if (!p.infuse_num) return;
                if (p.infuse_num < 0) return;

                p.desc = p.desc.replace(`Infuse (${p.infuse_num})`, `Infuse (${p.infuse_num - 1})`);
                p.infuse_num -= 1;

                if (p.infuse_num != 0) return;

                p.activate("infuse");
                p.desc = p.desc.replace(`Infuse (${p.infuse_num})`, "Infused");
            });
        }

        for (let i = 1; i <= 2; i++) {
            let plr;
            if (i === 1) plr = game.player1;
            else plr = game.player2;

            // Activate spells in the players hand
            plr.hand.forEach(c => {
                if (!(c instanceof Card)) throw new Error("Hand contains a non-card");
                
                // Placeholders
                c.replacePlaceholders();

                // Check for condition
                // @ts-expect-error
                let cleared_text = " (Condition cleared!)".brightGreen;
                // @ts-expect-error
                let cleared_text_alt = "Condition cleared!".brightGreen;
                c.desc = c.desc?.replace(cleared_text, "");
                c.desc = c.desc?.replace(cleared_text_alt, "");

                let condition = c.activate("condition");
                if (condition instanceof Array && condition[0] === true) {
                    if (c.desc) c.desc += cleared_text;
                    else c.desc += cleared_text_alt;
                }

                c.applyEnchantments(); // Just in case. Remove for small performance boost
            });
            plr.hand.forEach(c => {
                if (c.mana < 0) c.mana = 0;
            });
        }

        eventManager.tickHooks.forEach(hook => hook(key, val));
        return true;
    },

    /**
     * Do card passives
     *
     * @param key The key of the event
     * @param val The value of the event
     *
     * @returns Success
     */
    cardUpdate(key, val) {
        let game = globalThis.game;
        if (!game) return false;

        game.board.forEach(p => {
            p.forEach(m => {
                if (m.getHealth() <= 0) return; // This function gets called directly after a minion is killed.

                m.activate("unpassive", true);
                m.activate("passive", key, val);
            });
        });

        for (let i = 1; i <= 2; i++) {
            let plr;
            if (i === 1) plr = game.player1;
            else plr = game.player2;

            // Activate spells in the players hand
            plr.hand.forEach(c => {
                c.activate("handpassive", key, val);

                if (c.type != "Spell") return;

                c.activate("unpassive", true);
                c.activate("passive", key, val);
            });

            let wpn = plr.weapon;
            if (!wpn) continue;

            wpn.activate("unpassive", true);
            wpn.activate("passive", key, val);
        }

        game.triggerEventListeners(key, val);
        return true;
    },

    /**
     * Update quests and secrets
     *
     * @param quests_name The type of quest to update
     * @param key The key of the event
     * @param val The value of the event
     * @param plr The owner of the quest
     *
     * @returns Success
     */
    questUpdate(quests_name, key, val, plr) {
        let game = globalThis.game;
        if (!game) return false;

        plr[quests_name].forEach(s => {
            let quest: QuestType = s;

            if (quest.key != key) return;

            let [current, max] = quest.progress;

            let done = current + 1 >= max;
            if (quest.callback(val, done) === false) return;

            quest.progress[0]++;

            if (!done) return;

            // The quest/secret is done
            plr[quests_name].splice(plr[quests_name].indexOf(quest), 1);

            if (quests_name == "secrets") game!.input("\nYou triggered the opponents's '" + quest.name + "'.\n");

            if (quest.next) new Card(quest.next, plr).activate("cast");
        });

        return true;
    },

    /**
     * Broadcast an event
     *
     * @param key The key of the event
     * @param val The value of the event
     * @param plr The player who caused the event to happen
     * @param updateHistory Whether or not to update the history
     *
     * @returns Success
     */
    broadcast(key, val, plr, updateHistory = true) {
        let game = globalThis.game;
        if (!game) return false;

        eventManager.tick(key, val);

        if (updateHistory) eventManager.addHistory(key, val, plr);

        // Check if the event is suppressed
        if (game.suppressedEvents.includes(key)) return false;
        if (plr.classType !== "Player" || plr.id === -1) return false;

        if (!eventManager.events[key]) eventManager.events[key] = [[["GameLoop", game.turns]], [["GameLoop", game.turns]]];
        eventManager.events[key]![plr.id].push([val, game.turns]);

        eventManager.cardUpdate(key, val);

        eventManager.questUpdate("secrets",    key, val, plr.getOpponent());
        eventManager.questUpdate("sidequests", key, val, plr);
        eventManager.questUpdate("quests",     key, val, plr);

        return true;
    },

    /**
     * Write an event to history. Done automatically by `broadcast`.
     * 
     * @param key The key of the event
     * @param val The value of the event
     * @param plr The player who caused the event to happen
     */
    addHistory(key, val, plr) {
        let game = globalThis.game;
        if (!game) return;

        if (!eventManager.history[game.turns]) eventManager.history[game.turns] = [["GameLoop", "Init", plr]];
        eventManager.history[game.turns].push([key, val, plr]);
    },

    /**
     * Broadcast a dummy event. Use if you need to broadcast any event to kickstart an event listener, consider looking into `game.functions.hookToTick`.
     * 
     * Specifically, this broadcasts the `Dummy` event. DO NOT LISTEN FOR THAT EVENT.
     * 
     * @param plr The player who caused the event to happen
     * 
     * @returns Success
     */
    broadcastDummy(plr) {
        return eventManager.broadcast("Dummy", null, plr, false);
    },

    /**
     * Increment a stat
     *
     * @param player The player to update
     * @param key The key to increment
     * @param amount The amount to increment by
     *
     * @returns The new value
     */
    increment(player, key, amount = 1) {
        if (!eventManager.stats[key]) eventManager.stats[key] = [0, 0];

        eventManager.stats[key][player.id] += amount;

        return eventManager.stats[key][player.id];
    },
}

export class Game {
    /**
     * Some general functions that can be used.
     * 
     * This has a lot of abstraction, so don't be afraid to use them.
     * Look in here for more.
     */
    functions = functions;

    /**
     * The player that starts first.
     */
    player1: Player;

    /**
     * The player that starts with `The Coin`.
     */
    player2: Player;

    /**
     * The player whose turn it is.
     */
    player: Player;
    
    /**
     * The opponent of the player whose turn it is.
     * 
     * Same as `game.player.getOpponent()`.
     */
    opponent: Player;

    /**
     * Events & History managment and tracker.
     */
    events = eventManager;

    /**
     * This has a lot of functions for interacting with the user.
     * 
     * This is generally less useful than the `functions` object, since the majority of these functions are only used once in the source code.
     * However, some functions are still useful. For example, the `selectTarget` function.
     */
    interact = interact;

    /**
     * Some configuration for the game.
     * 
     * Look in the `config` folder.
     */
    config: GameConfig;

    /**
     * All of the cards that have been implemented so far.
     * 
     * Use `functions.getCards()` instead.
     */
    cards: Blueprint[] = [];

    Card = Card;

    /**
     * The turn counter.
     * 
     * This goes up at the beginning of each player's turn.
     * 
     * This means that, for example, if `Player 1`'s turn is on turn 0, then when it's `Player 1`'s turn again, the turn counter is 2.
     * 
     * Do
     * ```
     * Math.ceil(game.turns / 2)
     * ```
     * for a more conventional turn counter.
     */
    turns: number = 0;

    /**
     * The board of the game.
     * 
     * The 0th element is `game.player1`'s side of the board,
     * and the 1th element is `game.player2`'s side of the board.
     */
    board: Card[][] = [[], []];

    /**
     * The graveyard, a list of cards that have been killed.
     * 
     * The 0th element is `game.player1`'s graveyard,
     * and the 1st element is `game.player2`'s graveyard.
     */
    graveyard: Card[][] = [[], []];

    /**
     * The event listeners that are attached to the game currently.
     */
    eventListeners: {[key: number]: (key: EventKey, val: EventValue<EventKey>) => void} = {};

    /**
     * A list of event keys to suppress.
     * 
     * If an event with a key in this list is broadcast, it will add it to the history, and tick the game, but will not activate any passives / event listeners.
     */
    suppressedEvents: EventKey[] = [];

    /**
     * Whether or not the game is currently accepting input from the user.
     * 
     * If this is true, the user can't interact with the game. This will most likely cause an infinite loop, unless both players are ai's.
     */
    no_input: boolean = false;

    /**
     * If the game is currently running.
     * 
     * If this is false, the game loop will end.
     */
    running: boolean = true;

    /**
     * If the program is currently evaluating code. Should only be enabled while running a `eval` function.
     * 
     * This is used to throw errors in places that normally would just return null / "invalid".
     */
    evaling: boolean = false;

    /**
     * Some constant values.
     */
    constants: GameConstants;

    constructor() {
        globalThis.game = this;
    }
    
    /**
     * Sets up the game by assigning players and initializing game state.
     *
     * @param player1 The first player.
     * @param player2 The second player.
     */
    setup(player1: Player, player2: Player) {
        // Choose a random player to be player 1
        this.player1 = player1; // Set this to player 1 temporarily, in order to never be null
        this.player2 = player2;

        // Choose a random player to be player 1 and player 2
        if (this.functions.randInt(0, 1)) {
            this.player1 = player1;
            this.player2 = player2;
        } else {
            this.player1 = player2;
            this.player2 = player1;
        }

        // Set the starting players
        this.player = this.player1;
        this.opponent = this.player2;

        // Set the player's ids
        this.player1.id = 0;
        this.player2.id = 1;

        // Some constants
        this.constants = {
            REFUND: -1
        };

        globalThis.game = this;
    }

    /**
     * Ask the user a question and returns their answer
     *
     * @param q The question to ask
     * @param care If this is false, it overrides `game.no_input`. Only use this when debugging.
     *
     * @returns What the user answered
     */
    input(q: string = "", care: boolean = true): string {
        const wrapper = (a: string) => {
            if (this.player instanceof Player) this.events.broadcast("Input", a, this.player);
            return a;
        }

        if (this.no_input && care) return wrapper("");

        // Let the game make choices for the user
        if (this.player.inputQueue) {
            let queue = this.player.inputQueue;

            if (typeof(queue) == "string") return wrapper(queue);
            else if (!(queue instanceof Array)) return wrapper(question(q)); // Invalid queue

            const answer = queue[0];
            this.functions.remove(queue, answer);

            if (queue.length <= 0) this.player.inputQueue = undefined;

            return wrapper(answer);
        }

        return wrapper(question(q));
    }

    /**
     * Assigns an ai to the players if in the config.
     * 
     * Unassigns the player's ai's if not in the config.
     *
     * @returns Success
     */
    doConfigAI(): boolean {
        if (this.config.P1AI) {
            if (!this.player1.ai) this.player1.ai = new AI(this.player1);
        }
        else this.player1.ai = undefined;

        if (this.config.P2AI) {
            if (!this.player2.ai) this.player2.ai = new AI(this.player2);
        }
        else this.player2.ai = undefined;

        return true;
    }

    /**
     * Broadcast event to event listeners
     * 
     * @param key The name of the event (see events.txt)
     * @param val The value of the event
     * 
     * @returns Return values of all the executed functions
     */
    triggerEventListeners(key: EventKey, val: EventValue<EventKey>): any[] {
        let ret: any[] = [];
        Object.values(this.eventListeners).forEach(i => ret.push(i(key, val)));
        return ret;
    }

    // Start / End

    /**
     * Starts the game
     * 
     * @returns Success
     */
    startGame(): boolean {
        let players = [];

        // Add quest cards to the players hands
        for (let i = 0; i < 2; i++) {
            // Set the player's hero to the default hero for the class
            let plr: Player;
            if (i === 0) plr = this.player1;
            else plr = this.player2;
            
            let success = plr.setToStartingHero();
            if (!success) {
                console.log("File 'cards/StartingHeroes/" + plr.heroClass.toLowerCase().replaceAll(" ", "_") + ".ts' is either; Missing or Incorrect. Please copy the working 'cards/StartingHeroes/' folder from the github repo to restore a working copy. Error Code: 12");
                process.exit(1);
            }

            plr.deck.forEach(c => {
                if (!c.desc?.includes("Quest: ") && !c.desc?.includes("Questline: ")) return;

                this.suppressedEvents.push("AddCardToHand");
                plr.addToHand(c);
                this.suppressedEvents.pop();

                plr.deck.splice(plr.deck.indexOf(c), 1);
            });

            let nCards = (plr.id == 0) ? 3 : 4;
            while (plr.hand.length < nCards) {
                this.suppressedEvents.push("DrawCard");
                plr.drawCard();
                this.suppressedEvents.pop();
            }

            plr.deck.forEach(c => c.activate("startofgame"));
            plr.hand.forEach(c => c.activate("startofgame"));

            players.push(plr);
        }

        this.player1 = players[0];
        this.player2 = players[1];

        this.player1.maxMana = 1;
        this.player1.mana = 1;

        let the_coin = new Card("The Coin", this.player2);

        this.suppressedEvents.push("AddCardToHand");
        this.player2.addToHand(the_coin);
        this.suppressedEvents.pop();

        this.turns += 1;

        return true;
    }

    /**
     * Ends the game and declares `winner` as the winner
     * 
     * @param winner The winner
     * 
     * @returns Success
     */
    endGame(winner: Player): boolean {
        if (!winner) return false;

        this.interact.printName();

        this.input(`Player ${winner.name} wins!\n`);

        this.running = false;

        // Create log file
        this.functions.createLogFile();

        return true;
    }

    /**
     * Ends the players turn and starts the opponents turn
     * 
     * @returns Success
     */
    endTurn(): boolean {
        // Kill all minions with 0 or less health
        this.killMinions();

        // Update events
        this.events.broadcast("EndTurn", this.turns, this.player);

        let plr = this.player;
        let op = this.opponent;

        this.board[plr.id].forEach(m => {
            m.ready();
        });

        // Trigger unspent mana
        if (plr.mana > 0) this.events.broadcast("UnspentMana", plr.mana, plr);

        // Remove echo cards
        plr.hand = plr.hand.filter(c => !c.echo);
        plr.canAttack = true;

        // Turn starts
        this.turns++;
        
        // Mana stuff
        op.gainEmptyMana(1, true);
        op.mana = op.maxMana - op.overload;
        op.overload = 0;

        // Weapon stuff
        if (op.weapon) {
            if (op.weapon.getAttack() > 0) {
                op.attack = op.weapon.getAttack();
                op.weapon.resetAttackTimes();
            }
        }

        // Minion start of turn
        this.board[op.id].forEach(m => {
            // Dormant
            if (m.dormant) {
                if (this.turns > m.dormant) {
                    m.dormant = false;
                    m.sleepy = true;

                    m.immune = m.backups.init.immune;
                    m.turn = this.turns;

                    // If the battlecry use a function that depends on `game.player`
                    this.player = op;
                    m.activateBattlecry();
                    this.player = plr;
                }

                return;
            }

            m.canAttackHero = true;
            if (this.turns > (m.frozen_turn ?? -1) + 1) m.frozen = false;
            m.ready();

            // Stealth duration
            if (m.stealthDuration && m.stealthDuration > 0 && this.turns > m.stealthDuration) {
                m.stealthDuration = 0;
                m.removeKeyword("Stealth");
            }

            // Location cooldown
            if (m.type == "Location" && m.cooldown && m.cooldown > 0) m.cooldown--;
        });

        // Draw card
        op.drawCard();

        op.canUseHeroPower = true;

        this.events.broadcast("StartTurn", this.turns, op);

        this.player = op;
        this.opponent = plr;

        return true;
    }

    // Playing cards

    /**
     * Play a card
     * 
     * @param card The card to play
     * @param player The card's owner
     */
    playCard(card: Card, player: Player): GamePlayCardReturn {
        if (!card || !player) {
            if (this.evaling) throw new TypeError("Evaling Error - The `card` or `player` argument passed to `playCard` are invalid. Make sure you passed in both arguments.");
            return "invalid";
        }

        this.killMinions();

        while (card.keywords.includes("Tradeable")) {
            let q;

            if (player.ai) q = player.ai.trade(card);
            else q = this.interact.yesNoQuestion(player, "Would you like to trade " + this.functions.colorByRarity(card.displayName, card.rarity) + " for a random card in your deck?");

            if (!q) break;
            
            if (player.mana < 1) return "mana";

            player.mana -= 1;

            player.removeFromHand(card);
            player.drawCard();
            player.shuffleIntoDeck(card);

            this.events.broadcast("TradeCard", card, player);
    
            return "traded";
        }

        if (player[card.costType] < card.mana) return "mana";

        // Condition
        let condition = card.activate("condition");
        if (condition instanceof Array && condition[0] === false) {
            let warn = this.interact.yesNoQuestion(player, "WARNING: This card's condition is not fulfilled. Are you sure you want to play this card?".yellow);

            if (!warn) return "refund";
        }

        player[card.costType] -= card.mana;
        //card.mana = card.backups.mana;

        player.removeFromHand(card);

        // Echo
        let echo_clone = null;

        if (card.keywords.includes("Echo")) {
            echo_clone = card.perfectCopy(); // Create an exact copy of the card played
            echo_clone.echo = true;
        }

        let ret: GamePlayCardReturn = true;

        let op = player.getOpponent();
        let board = this.board[player.id];

        if (op.counter && op.counter.includes(card.type)) {
            op.counter.splice(op.counter.indexOf(card.type), 1);    
            return "counter";
        }

        // If the board has max capacity, and the card played is a minion or location card, prevent it.
        if (board.length >= this.config.maxBoardSpace && ["Minion", "Location"].includes(card.type)) {
            this.suppressedEvents.push("AddCardToHand");
            player.addToHand(card);
            this.suppressedEvents.pop();

            if (card.costType == "mana") player.refreshMana(card.mana);
            else player[card.costType] += card.mana;

            return "space";
        }

        // Add cardsplayed to history
        let historyIndex: number;
        historyIndex = this.events.history[this.turns].push(["PlayCard", card, this.player]);

        const removeFromHistory = () => {
            this.events.history[this.turns].splice(historyIndex - 1, 1);
        }

        this.events.broadcast("PlayCardUnsafe", card, player, false);

        // Finale
        if (player[card.costType] == 0) card.activate("finale");

        if (card.type === "Minion") {
            // Magnetize
            if (card.keywords.includes("Magnetic") && board.length > 0) {
                let mechs = board.filter(m => m.tribe?.includes("Mech"));
    
                // I'm using while loops to prevent a million indents
                while (mechs.length > 0) {
                    let minion = this.interact.selectTarget("Which minion do you want this to Magnetize to:", null, "friendly", "minion");
                    if (!minion || minion instanceof Player) break;

                    if (!minion.tribe?.includes("Mech")) {
                        console.log("That minion is not a Mech.");
                        continue;
                    }
    
                    minion.addStats(card.getAttack(), card.getHealth());
    
                    card.keywords.forEach(k => {
                        // TSC for some reason, forgets that minion should be of `Card` type here, so we have to remind it. This is a workaround
                        if (!(minion instanceof Card)) return;

                        minion.addKeyword(k);
                    });

                    if (minion.maxHealth && card.maxHealth) {
                        minion.maxHealth += card.maxHealth;
                    }
    
                    if (card.abilities.deathrattle) {
                        card.abilities.deathrattle.forEach(d => {
                            // Look at the comment above
                            if (!(minion instanceof Card)) return;

                            minion.addDeathrattle(d);
                        });
                    }

                    if (echo_clone) player.addToHand(echo_clone);
    
                    // Corrupt
                    player.hand.forEach(c => {
                        if (c.corrupt && card.mana <= c.mana) {
                            let t = new Card(c.corrupt, c.plr);

                            player.removeFromHand(c);

                            this.suppressedEvents.push("AddCardToHand");
                            c.plr.addToHand(t);
                            this.suppressedEvents.pop();
                        }
                    });

                    return "magnetize";
                }
    
            }

            if (!card.dormant && card.activateBattlecry() === -1) {
                removeFromHistory();

                return "refund";
            }

            this.suppressedEvents.push("SummonMinion");
            ret = this.summonMinion(card, player);
            this.suppressedEvents.pop();
        } else if (card.type === "Spell") {
            if (card.activate("cast") === -1) {
                removeFromHistory();

                return "refund";
            }

            if (card.keywords.includes("Twinspell")) {
                card.removeKeyword("Twinspell");
                card.desc = card.desc?.split("Twinspell")[0].trim();

                player.addToHand(card);
            }

            board.forEach(m => {
                m.activate("spellburst");
                m.abilities.spellburst = undefined;
            });
        } else if (card.type === "Weapon") {
            player.setWeapon(card);

            card.activateBattlecry();
        } else if (card.type === "Hero") {
            player.setHero(card, 5);

            card.activateBattlecry();
        } else if (card.type === "Location") {
            card.setStats(0, card.getHealth());
            card.immune = true;
            card.cooldown = 0;

            this.suppressedEvents.push("SummonMinion");
            ret = this.summonMinion(card, player);
            this.suppressedEvents.pop();
        }

        if (echo_clone) player.addToHand(echo_clone);

        this.events.broadcast("PlayCard", card, player, false);

        let stat;
        let playCardEvent = this.events.events.PlayCard;
        if (playCardEvent) stat = playCardEvent[player.id];

        // If the previous card played was played on the same turn as this one, activate combo
        if (stat && stat.length > 1 && stat[stat.length - 2][0].turn == this.turns) card.activate("combo");

        player.hand.forEach(c => {
            if (c.corrupt && card.mana > c.mana) {
                let t = new Card(c.corrupt, c.plr);

                player.removeFromHand(c);

                this.suppressedEvents.push("AddCardToHand");
                c.plr.addToHand(t);
                this.suppressedEvents.pop();
            }
        });

        this.killMinions();

        return ret;
    }

    /**
     * Summon a minion.
     * Broadcasts the `SummonMinion` event
     * 
     * @param minion The minion to summon
     * @param player The player who gets the minion
     * @param trigger_colossal If the minion has colossal, summon the other minions.
     * 
     * @returns The minion summoned
     */
    summonMinion(minion: Card, player: Player, trigger_colossal: boolean = true): Card | "space" | "colossal" | "invalid" {
        if (!minion || !player) {
            if (this.evaling) throw new TypeError("Evaling Error - The `minion` or `player` argument passed to `summonMinion` are invalid. Make sure you passed in both arguments.");
            return "invalid";
        };

        // If the board has max capacity, and the card played is a minion or location card, prevent it.
        if (this.board[player.id].length >= this.config.maxBoardSpace) return "space";
        this.events.broadcast("SummonMinion", minion, player);

        player.spellDamage = 0;

        if (minion.keywords.includes("Charge")) minion.sleepy = false;

        if (minion.keywords.includes("Rush")) {
            minion.sleepy = false;
            minion.canAttackHero = false;
        }

        if (minion.colossal && trigger_colossal) {
            // minion.colossal is a string array.
            // example: ["Left Arm", "", "Right Arm"]
            // the "" gets replaced with the main minion

            minion.colossal.forEach(v => {
                this.suppressedEvents.push("SummonMinion");

                if (v == "") {
                    this.summonMinion(minion, player, false);
                    this.suppressedEvents.pop();
                    return;
                }

                let card = new Card(v, player);
                card.dormant = minion.dormant;

                this.summonMinion(card, player);
                this.suppressedEvents.pop();
            });

            return "colossal";
        }

        if (minion.dormant) {
            minion.dormant += this.turns;
            minion.immune = true;
            minion.sleepy = false;
        }

        this.board[player.id].push(minion);

        this.board[player.id].forEach(m => {
            m.keywords.forEach(k => {
                if (k.startsWith("Spell Damage +")) player.spellDamage += parseInt(k.split("+")[1]);
            });
        });

        return minion;
    }

    // Interacting with minions

    /**
     * Makes a minion or hero attack another minion or hero
     * 
     * @param attacker attacker | Amount of damage to deal
     * @param target The target
     * 
     * @returns Success | Errorcode
     */
    attack(attacker: Target | number | string, target: Target): GameAttackReturn {
        if (!attacker || !target) {
            if (this.evaling) throw new TypeError("Evaling Error - The `attacker` or `target` argument passed to `attack` are invalid. Make sure you passed in both arguments.");
            return "invalid";
        }

        this.killMinions();

        if (target.immune) return "immune";

        // Attacker is a number
        let spellDmgRegex = /\$(\d+?)/;
        if (typeof attacker === "string" && spellDmgRegex.test(attacker)) {
            let match = attacker.match(spellDmgRegex);
            if (!match) return "invalid";
            
            let dmg = parseInt(match[1]);
            dmg += this.player.spellDamage;

            this.events.broadcast("SpellDealsDamage", [target, dmg], this.player);
            attacker = dmg;
        }

        if (typeof(attacker) === "number") {
            let dmg = attacker;

            if (target.classType == "Player") {
                target.remHealth(dmg);
                return true;
            }

            if (target.keywords.includes("Divine Shield")) {
                target.removeKeyword("Divine Shield");
                return "divineshield";
            }

            target.remStats(0, dmg)

            // Remove frenzy
            if (target.getHealth() > 0 && target.abilities.frenzy && target.activate("frenzy") !== -1) target.abilities.frenzy = undefined;

            return true;
        }

        if (typeof attacker === "string") return "invalid";

        // Check if there is a minion with taunt
        let taunts = this.board[this.opponent.id].filter(m => m.keywords.includes("Taunt"));
        if (taunts.length > 0) {
            // If the target is a card and has taunt, you are allowed to attack it
            if (target instanceof Card && target.keywords.includes("Taunt")) {}
            else return "taunt";
        }

        if (attacker.frozen) return "frozen";

        // Attacker is a player
        if (attacker.classType == "Player") {
            if (attacker.attack <= 0) return "plrnoattack";
            if (!attacker.canAttack) return "plrhasattacked";

            // Target is a player
            if (target.classType == "Player") {
                this.attack(attacker.attack, target);
                this.events.broadcast("Attack", [attacker, target], attacker);
                
                attacker.canAttack = false;
                if (!attacker.weapon) return true;

                const wpn = attacker.weapon;

                // If the weapon would be part of the attack, remove 1 durability
                if (wpn.attackTimes && wpn.attackTimes > 0 && wpn.getAttack()) {
                    wpn.attackTimes -= 1;
                    wpn.remStats(0, 1);
                }

                return true;
            }

            // Target is a minion
            if (target.keywords.includes("Stealth")) return "stealth";
    
            this.attack(attacker.attack, target);
            this.attack(target.getAttack(), attacker);
            this.events.broadcast("Attack", [attacker, target], attacker);

            this.killMinions();

            attacker.canAttack = false;
    
            // Remove frenzy
            if (target.getHealth() > 0 && target.abilities.frenzy && target.activate("frenzy") !== -1) target.abilities.frenzy = undefined;

            this.killMinions();
            if (!attacker.weapon) return true;
    
            const wpn = attacker.weapon;

            if (wpn.attackTimes && wpn.attackTimes > 0 && wpn.getAttack()) {
                wpn.attackTimes -= 1;

                wpn.remStats(0, 1);

                if (wpn.keywords.includes("Poisonous")) target.kill();
            }

            if (wpn.getHealth() > 0) attacker.weapon = wpn;
            this.killMinions();
    
            return true;
        }

        // Attacker is a minion
        if (attacker.dormant) return "dormant";
        if (attacker.attackTimes && attacker.attackTimes <= 0) return "hasattacked";
        if (attacker.sleepy) return "sleepy";
        if (attacker.getAttack() <= 0) return "noattack";

        // Target is a player
        if (target.classType == "Player") {
            if (!attacker.canAttackHero) return "cantattackhero";

            if (attacker.keywords.includes("Stealth")) attacker.removeKeyword("Stealth");
            if (attacker.keywords.includes("Lifesteal")) attacker.plr.addHealth(attacker.getAttack());

            target.remHealth(attacker.getAttack());
            attacker.decAttack();
            this.events.broadcast("Attack", [attacker, target], attacker.plr);

            return true;
        }

        // Target is a minion
        if (target.keywords.includes("Stealth")) return "stealth";

        // Cleave
        while (attacker.keywords.includes("Cleave")) {
            let b = this.board[target.plr.id];

            let index = b.indexOf(target);
            if (index == -1) break;

            if (index > 0) this.attack(attacker.getAttack(), b[index - 1]);
            if (index < b.length - 1) this.attack(attacker.getAttack(), b[index + 1]);

            break;
        }

        attacker.decAttack();

        let dmgTarget = true;
        let dmgAttacker = true;

        if (attacker.immune) dmgAttacker = false;

        if (dmgAttacker && attacker.keywords.includes("Divine Shield")) {
            attacker.removeKeyword("Divine Shield");
            dmgAttacker = false;
        }

        if (dmgAttacker) {
            attacker.remStats(0, target.getAttack());
            
            // Remove frenzy
            if (attacker.getHealth() > 0 && attacker.abilities.frenzy && attacker.activate("frenzy") !== -1) attacker.abilities.frenzy = undefined;
        }

        if (attacker.keywords.includes("Stealth")) attacker.removeKeyword("Stealth");
        
        if (dmgAttacker && target.keywords.includes("Poisonous")) attacker.kill();

        if (target.keywords.includes("Divine Shield")) {
            target.removeKeyword("Divine Shield");
            dmgTarget = false;
        }

        if (dmgTarget && attacker.keywords.includes("Lifesteal")) attacker.plr.addHealth(attacker.getAttack());
        if (dmgTarget && attacker.keywords.includes("Poisonous")) target.kill();

        if (dmgTarget) target.remStats(0, attacker.getAttack())
        this.events.broadcast("Attack", [attacker, target], attacker.plr);

        // Remove frenzy
        if (target.getHealth() > 0 && target.abilities.frenzy && target.activate("frenzy") !== -1) target.abilities.frenzy = undefined;
        if (target.getHealth() < 0) attacker.activate("overkill");
        if (target.getHealth() == 0) attacker.activate("honorablekill");

        this.killMinions();

        return true;
    }

    /**
     * Kill all minions with 0 or less health
     * 
     * @returns The amount of minions killed
     */
    killMinions(): number {
        let amount = 0;

        for (let p = 0; p < 2; p++) {
            let plr: Player;
            if (p === 0) plr = this.player1;
            else plr = this.player2;

            let sparedMinions: Card[] = [];
            
            this.board[p].forEach(m => {
                if (m.type == "Location") return;
                if (m.getHealth() <= 0) m.activate("deathrattle");
            });

            this.board[p].forEach(m => {
                // Add minions with more than 0 health to n.
                if (m.getHealth() > 0 || m.type == "Location") {
                    sparedMinions.push(m);
                    return;
                }

                m.activate("unpassive", false); // Tell the minion that it is going to die
                this.events.broadcast("KillMinion", m, this.player);

                m.turnKilled = this.turns;
                amount++;

                plr.corpses++;
                this.graveyard[p].push(m);

                if (!m.keywords.includes("Reborn")) return;

                // Reborn
                let minion = m.imperfectCopy();

                minion.removeKeyword("Reborn");

                // Reduce the minion's health to 1, keep the minion's attack the same
                minion.setStats(minion.getAttack(), 1);

                this.suppressedEvents.push("SummonMinion");
                this.summonMinion(minion, plr);
                this.suppressedEvents.pop();

                // Activate the minion's passive
                // We're doing this because otherwise, the passive won't be activated this turn
                // Normally when we summon a minion, it will be activated immediately, since the `PlayCard` event gets triggered immediately after playing the card
                // but this is not the case here, since we are directly summoning the minion, and we told it to not broadcast the event.
                // The `reborn` string is passed in order for the card to know why the passive was triggered. The card can explicitly look for the `reborn` string
                // in its passive.
                // So it looks like this:
                // minion.activate(key, reason, minion);
                minion.activate("passive", "reborn", m);

                sparedMinions.push(minion);
            });

            this.board[p] = sparedMinions;
        }

        return amount;
    }
}
