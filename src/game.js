const { question }  = require('readline-sync');
const { Functions } = require("./functions");
const { Player }    = require("./player");
const { Card }      = require("./card");
const { Interact }  = require("./interact");
const { AI }        = require('./ai');

// Event key typdef
/**
 * @typedef {"FatalDamage" | "EndTurn" | "StartTurn" | "HealthRestored" | "UnspentMana" | "GainOverload" | "GainHeroAttack" | "TakeDamage" | "PlayCard" | "PlayCardUnsafe" | "SummonMinion" | "KillMinion" | "DamageMinion" | "CancelCard" | "CastSpellOnMinion" | "TradeCard" | "FreezeCard" | "AddCardToDeck" | "AddCardToHand" | "DrawCard" | "SpellDealsDamage" | "Attack" | "HeroPower" | "Eval"} EventKeys
 */

class EventManager {
    /**
     * @param {Game} game 
     */
    constructor(game) {
        this.game = game;

        this.eventListeners = 0;

        this.history = {};
    }

    /**
     * Do card passives
     *
     * @param {EventKeys} key The key of the event
     * @param {any} val The value of the event
     *
     * @returns {boolean} Success
     */
    cardUpdate(key, val) {
        // Infuse
        if (key == "KillMinion") {
            val.plr.hand.forEach(p => {
                if (p.infuse_num < 0) return;

                p.desc = p.desc.replace(`Infuse (${p.infuse_num})`, `Infuse (${p.infuse_num - 1})`);
                p.infuse_num -= 1;

                if (p.infuse_num != 0) return;

                p.activate("infuse");
                p.desc = p.desc.replace(`Infuse (${p.infuse_num})`, "Infused");
            });
        }

        this.game.board.forEach(p => {
            p.forEach(m => {
                if (m.getHealth() <= 0) return; // This function gets called directly after a minion is killed.

                m.activate("unpassive", true);
                m.activate("passive", key, val);
            });
        });

        for (let i = 1; i <= 2; i++) {
            let plr = this.game["player" + i];

            // Activate spells in the players hand
            plr.hand.forEach(c => {
                c.activate("handpassive", key, val);

                // Placeholders
                c.replacePlaceholders();

                // Check for condition
                let cleared_text = " (Condition cleared!)".brightGreen;
                let cleared_text_alt = "Condition cleared!".brightGreen;
                c.desc = c.desc.replace(cleared_text, "");
                c.desc = c.desc.replace(cleared_text_alt, "");
                if (c.activate("condition")[0] === true) {
                    if (c.desc) c.desc += cleared_text;
                    else c.desc += cleared_text_alt;
                }

                c.applyEnchantments(); // Just in case. Remove for small performance boost

                if (c.type != "Spell") return;

                c.activate("unpassive", true);
                c.activate("passive", key, val);

                c.replacePlaceholders();
            });
            plr.hand.forEach(c => {
                if (c.mana < 0) c.mana = 0;
            });

            let wpn = plr.weapon;
            if (!wpn) continue;

            wpn.activate("unpassive", true);
            wpn.activate("passive", key, val);
        }

        this.game.triggerEventListeners(key, val);
        return true;
    }

    /**
     * Update quests and secrets
     *
     * @param {"Secret" | "Quest" | "Questline"} quests_name The type of quest to update
     * @param {EventKeys} key The key of the event
     * @param {any} val The value of the event
     * @param {Player} plr The owner of the quest
     *
     * @returns {bool} Success
     */
    questUpdate(quests_name, key, val, plr) {
        plr[quests_name].forEach(s => {
            if (s["key"] != key) return;

            let [current, max] = s["progress"];

            let done = current + 1 >= max;
            if (s["callback"](val, s["turn"], done) === false) return;

            s["progress"][0]++;

            if (!done) return;

            // The quest/secret is done
            plr[quests_name].splice(plr[quests_name].indexOf(s), 1);

            if (quests_name == "secrets") this.game.input("\nYou triggered the opponents's '" + s.name + "'.\n");

            if (s["next"]) new Card(s["next"], plr).activate("cast");
        });

        return true;
    }

    /**
     * Broadcast an event
     *
     * @param {EventKeys} key The key of the event
     * @param {any} val The value of the event
     * @param {Player} plr The player who caused the event to happen
     * @param {boolean} [updateHistory=true] Whether or not to update the history
     *
     * @returns {bool} Success
     */
    broadcast(key, val, plr, updateHistory = true) {
        if (!this[key]) this[key] = [[], []];
        if (updateHistory && !this.history[this.game.turns]) this.history[this.game.turns] = [];

        this[key][plr.id].push([val, this.game.turns]);
        if (updateHistory) this.history[this.game.turns].push([key, val, plr]);

        this.cardUpdate(key, val);

        this.questUpdate("secrets",    key, val, plr.getOpponent());
        this.questUpdate("sidequests", key, val, plr);
        this.questUpdate("quests",     key, val, plr);

        return true;
    }

    /**
     * Increment a stat
     *
     * @param {Player} player The player to update
     * @param {string} key The key to increment
     * @param {number} [amount=1] The amount to increment by
     *
     * @returns {number} The new value
     */
    increment(player, key, amount = 1) {
        if (!this[key]) this[key] = [0, 0];

        this[key][player.id] += amount;

        return this[key][player.id];
    }
}

class Game {
    /**
     * @param {Player} player1 
     * @param {Player} player2 
     */
    constructor(player1, player2) {
        // Choose a random player to be player 1
        const functions = new Functions(this);

        if (functions.randInt(0, 1)) {
            this.player1 = player1;
            this.player2 = player2;
        } else {
            this.player1 = player2;
            this.player2 = player1;
        }

        /**
         * @type {Player}
         */
        this.player = this.player1;

        /**
         * @type {Player}
         */
        this.opponent = this.player2;

        this.player1.id = 0;
        this.player2.id = 1;

        this.player1.game = this;
        this.player2.game = this;

        this.Card = Card;
        this.Player = Player;
        this.AI = AI;

        /**
         * @type {Functions}
         */
        this.functions = functions;

        /**
         * @type {EventManager}
         */
        this.events = new EventManager(this);

        /**
         * @type {Interact}
         */
        this.interact = new Interact(this);

        this.config = {};

        /**
         * @type {Card[]}
         */
        this.cards = [];

        this.turns = 0;

        /**
         * @type {[[Card]]}
         */
        this.board = [[], []];

        /**
         * @type {[[Card]]}
         */
        this.graveyard = [[], []];

        this.eventListeners = {};

        this.no_input = false;

        this.running = true;
    }

    /**
     * Ask the user a question and returns their answer
     *
     * @param {string} q The question to ask
     * @param {boolean} [care=true] If this is false, it overrides `game.no_input`. Only use this when debugging.
     *
     * @returns {string} What the user answered
     */
    input(q, care = true) {
        if (this.no_input && care) return "";

        return question(q);
    }

    /**
     * Assigns an ai to the players if in the config.
     *
     * @returns {boolean} Success
     */
    doConfigAI() {
        if (this.config.P1AI) this.player1.ai = new AI(this.player1);
        if (this.config.P2AI) this.player2.ai = new AI(this.player2);

        return true;
    }

    /**
     * Broadcast event to event listeners
     * 
     * @param {string} key The name of the event (see events.txt)
     * @param {any[]} val The value of the event
     * 
     * @returns {any[]} Return values of all the executed functions
     */
    triggerEventListeners(key, val) {
        let ret = [];
        Object.values(this.eventListeners).forEach(i => ret.push(i(this, key, val)));
        return ret;
    }

    // Start / End

    /**
     * Starts the game
     * 
     * @returns {boolean} Success
     */
    startGame() {
        let players = [];

        // Add quest cards to the players hands
        for (let i = 0; i < 2; i++) {
            // Set the player's hero to the default hero for the class
            let plr = this["player" + (i + 1)];
            
            let success = plr.setToStartingHero();
            if (!success) {
                console.log("File 'cards/StartingHeroes/" + plr.heroClass.toLowerCase().replaceAll(" ", "_") + ".js' is either; Missing or Incorrect. Please copy the working 'cards/StartingHeroes/' folder from the github repo to restore a working copy. Error Code: 12");
                require("process").exit(1);
            }

            plr.deck.forEach(c => {
                if (!c.desc.includes("Quest: ") && !c.desc.includes("Questline: ")) return;

                plr.addToHand(c, false);
                plr.deck.splice(plr.deck.indexOf(c), 1);
            });

            let nCards = (plr.id == 0) ? 3 : 4;
            while (plr.hand.length < nCards) plr.drawCard(false);

            plr.deck.forEach(c => c.activate("startofgame"));
            plr.hand.forEach(c => c.activate("startofgame"));

            players.push(plr);
        }

        this.player1 = players[0];
        this.player2 = players[1];

        this.player1.maxMana = 1;
        this.player1.mana = 1;

        this.player2.addToHand(new Card("The Coin", this.player2), false);

        this.turns += 1;

        return true;
    }

    /**
     * Ends the game and declares `winner` as the winner
     * 
     * @param {Player} winner The winner
     * 
     * @returns {bool} Success
     */
    endGame(winner) {
        this.interact.printName();

        this.input(`Player ${winner.name} wins!\n`);

        // If any of the players are ai's, show their moves when the game ends
        if ((this.player1.ai || this.player2.ai) && this.config.debug) this.interact.doTurnLogic("/ai");

        this.running = false;

        // Create log file
        this.functions.createLogFile();

        return true;
    }

    /**
     * Ends the players turn and starts the opponents turn
     * 
     * @returns {bool} Success
     */
    endTurn() {
        this.killMinions();

        // Update events
        this.events.broadcast("EndTurn", this.turns, this.player);

        let plr = this.player;
        let op = this.opponent;

        this.board[plr.id].forEach(m => {
            m.sleepy = false;
            m.resetAttackTimes();
        });

        // Trigger unspent mana
        if (plr.mana > 0) this.events.broadcast("UnspentMana", plr.mana, plr);

        // Remove echo cards
        plr.hand = plr.hand.filter(c => !c.echo);

        plr.attack = 0;

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
            if (this.turns > m.frozen_turn + 1) m.frozen = false;
            m.sleepy = false;
            m.resetAttackTimes();

            // Stealth duration
            if (m.stealthDuration > 0 && this.turns > m.stealthDuration) {
                m.stealthDuration = 0;
                m.removeKeyword("Stealth");
            }

            // Location cooldown
            if (m.type == "Location" && m.cooldown > 0) m.cooldown--;
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
     * @param {Card} card The card to play
     * @param {Player} player The card's owner
     * 
     * @returns {Card | "mana" | "traded" | "space" | "magnetize" | "colossal" | "refund"}
     */
    playCard(card, player) {
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
        if (card.activate("condition")[0] === false) {
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

        let ret = true;

        let op = player.getOpponent();
        let board = this.board[player.id];

        if (op.counter && op.counter.includes(card.type)) {
            op.counter.splice(op.counter.indexOf(card.type), 1);    
            return "counter";
        }

        // If the board has max capacity, and the card played is a minion or location card, prevent it.
        if (board.length >= this.config.maxBoardSpace && ["Minion", "Location"].includes(card.type)) {
            player.addToHand(card, false);

            if (card.costType == "mana") player.refreshMana(card.mana);
            else player[card.costType] += card.mana;

            return "space";
        }

        // Add cardsplayed to history
        let historyIndex;
        if (!this.events.history[this.turns]) this.events.history[this.turns] = [];
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
                let mechs = board.filter(m => m.tribe.includes("Mech"));
    
                // I'm using while loops to prevent a million indents
                while (mechs.length > 0) {
                    let minion = this.interact.selectTarget("Which minion do you want this to Magnetize to:", false, "self", "minion");
                    if (!minion) break;
                    if (!minion.tribe.includes("Mech")) {
                        console.log("That minion is not a Mech.");
                        continue;
                    }
    
                    minion.addStats(card.getAttack(), card.getHealth());
    
                    card.keywords.forEach(k => {
                        minion.addKeyword(k);
                    });

                    minion.maxHealth += card.maxHealth;
    
                    if (card.deathrattle) card.deathrattle.forEach(d => minion.addDeathrattle(d));
                    if (echo_clone) player.addToHand(echo_clone);
    
                    // Corrupt
                    player.hand.forEach(c => {
                        if (c.corrupt && card.mana <= c.mana) {
                            let t = new Card(c.corrupt, c.plr);

                            player.removeFromHand(c);
                            c.plr.addToHand(t, false);
                        }
                    });

                    return "magnetize";
                }
    
            }

            if (!card.dormant && card.activateBattlecry() === -1) {
                removeFromHistory();

                return "refund";
            }

            ret = this.summonMinion(card, player, false);
        } else if (card.type === "Spell") {
            if (card.activate("cast") === -1) {
                removeFromHistory();

                return "refund";
            }

            if (card.keywords.includes("Twinspell")) {
                card.removeKeyword("Twinspell");
                card.desc = card.desc.split("Twinspell")[0].trim();

                player.addToHand(card);
            }

            board.forEach(m => {
                m.activate("spellburst");
                m.spellburst = undefined;
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

            ret = this.summonMinion(card, player, false);
        }

        if (echo_clone) player.addToHand(echo_clone);

        this.events.broadcast("PlayCard", card, player, false);
        let stat = this.events.PlayCard[player.id];

        // If the previous card played was played on the same turn as this one, activate combo
        if (stat.length > 1 && stat[stat.length - 2][0].turn == this.turns) card.activate("combo");

        player.hand.forEach(c => {
            if (c.corrupt && card.mana > c.mana) {
                let t = new Card(c.corrupt, c.plr);

                player.removeFromHand(c);
                c.plr.addToHand(t, false);
            }
        });

        this.killMinions();

        return ret;
    }

    /**
     * Summon a minion
     * 
     * @param {Card} minion The minion to summon
     * @param {Player} player The player who gets the minion
     * @param {boolean} [update=true] If the summon should broadcast an event.
     * @param {boolean} [trigger_colossal=true] If the minion has colossal, summon the other minions.
     * 
     * @returns {Card | "space" | "colossal"} The minion summoned
     */
    summonMinion(minion, player, update = true, trigger_colossal = true) {
        // If the board has max capacity, and the card played is a minion or location card, prevent it.
        if (this.board[player.id].length >= this.config.maxBoardSpace) return "space";


        if (update) this.events.broadcast("SummonMinion", minion, player);

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
                if (v == "") return this.summonMinion(minion, player, false, false);

                let card = new Card(v, player);
                card.dormant = minion.dormant;

                this.summonMinion(card, player, false);

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
     * @param {Card | Player | number} attacker The attacker | Amount of damage to deal
     * @param {Card | Player} target The target
     * 
     * @returns {boolean | "divineshield" | "taunt" | "stealth" | "frozen" | "plrnoattack" | "noattack" | "hasattacked" | "sleepy" | "cantattackhero" | "immune"} Success | Errorcode
     */
    attack(attacker, target) {
        this.killMinions();

        // Attacker is a number
        if (typeof(attacker) === "number") {
            let dmg = attacker;

            if (target instanceof Player) {
                target.remHealth(dmg);
                return true;
            }

            if (target.keywords.includes("Divine Shield")) {
                target.removeKeyword("Divine Shield");
                return "divineshield";
            }

            target.remStats(0, dmg)
            if (target.getHealth() > 0 && target.activate("frenzy") !== -1) target.frenzy = undefined;

            return true;
        }

        // Check if there is a minion with taunt
        let taunts = this.board[this.opponent.id].filter(m => m.keywords.includes("Taunt"));
        if (taunts.length > 0) {
            // If the target is a card and has taunt, you are allowed to attack it
            if (target instanceof Card && target.keywords.includes("Taunt")) {}
            else return "taunt";
        }

        if (attacker.frozen) return "frozen";
        if (target.immune) return "immune";
        if (attacker.dormant) return "dormant";

        // Attacker is a player
        if (attacker instanceof Player) {
            if (attacker.attack <= 0) return "plrnoattack";

            // Target is a player
            if (target instanceof Player) {
                this.attack(attacker.attack, target);
                this.events.broadcast("Attack", [attacker, target], attacker);
                
                attacker.attack = 0;
                if (!attacker.weapon) return true;

                const wpn = attacker.weapon;

                // If the weapon would be part of the attack, remove 1 durability
                if (wpn.attackTimes > 0 && wpn.getAttack()) {
                    wpn.attackTimes -= 1;

                    wpn.activate("onattack");
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

            attacker.attack = 0;
    
            if (target.getHealth() > 0 && target.activate("frenzy") !== -1) target.frenzy = undefined;

            this.killMinions();
            if (!attacker.weapon) return true;
    
            const wpn = attacker.weapon;

            if (wpn.attackTimes > 0 && wpn.getAttack()) {
                wpn.attackTimes -= 1;

                wpn.remStats(0, 1);

                if (wpn.keywords.includes("Poisonous")) target.kill();
            }

            if (wpn.getHealth() > 0) attacker.weapon = wpn;
            this.killMinions();
    
            return true;
        }

        // Attacker is a minion
        if (attacker.attackTimes <= 0) return "hasattacked";
        if (attacker.sleepy) return "sleepy";
        if (attacker.getAttack() <= 0) return "noattack";

        // Target is a player
        if (target instanceof Player) {
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
            
            if (attacker.getHealth() > 0 && attacker.activate("frenzy") !== -1) attacker.frenzy = undefined;
        }

        if (attacker.keywords.includes("Stealth")) attacker.removeKeyword("Stealth");
    
        attacker.activate("onattack");
    
        if (dmgAttacker && target.keywords.includes("Poisonous")) attacker.kill();

        if (target.keywords.includes("Divine Shield")) {
            target.removeKeyword("Divine Shield");
            dmgTarget = false;
        }

        if (dmgTarget && attacker.keywords.includes("Lifesteal")) attacker.plr.addHealth(attacker.getAttack());
        if (dmgTarget && attacker.keywords.includes("Poisonous")) target.kill();

        if (dmgTarget) target.remStats(0, attacker.getAttack())
        this.events.broadcast("Attack", [attacker, target], attacker.plr);

        if (target.getHealth() > 0 && target.activate("frenzy") !== -1) target.frenzy = undefined;
        if (target.getHealth() < 0) attacker.activate("overkill");
        if (target.getHealth() == 0) attacker.activate("honorablekill");

        this.killMinions();

        return true;
    }

    /**
     * Kill all minions with 0 or less health
     * 
     * @returns {number} The amount of minions killed
     */
    killMinions() {
        let amount = 0;

        for (let p = 0; p < 2; p++) {
            let plr = this["player" + (p + 1)];
            let n = [];
            
            this.board[p].forEach(m => {
                if (m.getHealth() <= 0) m.activate("deathrattle");
            });

            this.board[p].forEach(m => {
                // Add minions with more than 0 health to n.
                if (m.getHealth() > 0) {
                    n.push(m);
                    return;
                }

                m.activate("unpassive", false); // Tell the minion that it is going to die
                this.events.broadcast("KillMinion", m, this.player);

                m.turnKilled = this.turns;
                amount++;

                if (!m.keywords.includes("Reborn")) {
                    plr.corpses++;
                    this.graveyard[p].push(m);
                    return;
                }

                // Reborn
                let minion = m.imperfectCopy();

                minion.removeKeyword("Reborn");
                minion.setStats(minion.getAttack(), 1);

                this.summonMinion(minion, plr, false);
                minion.activate("passive", "reborn", m);

                n.push(minion);
            });

            this.board[p] = n;
        }

        return amount;
    }
}

exports.Game = Game;
exports.EventManager = EventManager;
