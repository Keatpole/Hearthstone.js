//@ts-check
const { Card } = require("./card");
const { Game } = require("./game");
const { Player } = require("./player");
const { get, set } = require("./shared");
const lodash = require("lodash");

/**
 * @type {Game}
 */
let game;

function getInternalGame() {
    let tempGame = get();
    if (!tempGame) return;

    game = tempGame;
}

getInternalGame();

class SimulationAI {
    /**
     * This is the old Sentiment Analysis based AI.
     * 
     * @param {Player} plr 
     */
    constructor(plr) {
        getInternalGame();

        /**
         * @type {import("./types").AIHistory[]}
         */
        this.history = [];

        /**
         * @type {boolean}
         */
        this.canAttack = true;

        /**
         * @type {SentimentAI}
         */
        this.backup_ai = new SentimentAI(plr);

        /**
         * @type {boolean}
         */
        this.logAction = (game.config.debug && game.config.aiLogsEveryAction);

        /**
         * @type {Player}
         */
        this.plr = plr;
    }

    /**
     * Calculate the best move and return the result
     * 
     * @returns {Card | string} Result
     */
    chooseMove() {
        // Makes a move in the simulation
        // The ai is not even playing anything

        game.log("AI: Choosing a move...", !this.logAction);

        /**
         * @type {[Card | string, number]}
         */
        let best_move = ["", -Infinity];

        // This is more performant, but less correct.
        /*// TODO: This doesn't quite work with `this._evaluate`
        let simulation = this._createSimulation();
        let lastScore = 0;

        game.log(`AI: Calculating baseline...`, !this.logAction);
        let baseline = this._evaluate(simulation);
        baseline = parseFloat(baseline.toFixed(3));

        let alreadyScored = [];

        simulation.player.hand.forEach(card => {
            let index = simulation.player.hand.indexOf(card);
            if (index === -1) return false;
            index += 1;

            // If that card is already scored, skip it
            if (alreadyScored.filter(c => c.name === card.name).some(c => {
                let copy = c.perfectCopy();

                delete copy.uuid;
                delete copy.plr;
                delete copy.backups;

                // Check if copy == card
                let cleanCard = card.perfectCopy();

                // @ts-ignore
                delete cleanCard.uuid;
                // @ts-ignore
                delete cleanCard.plr;
                // @ts-ignore
                delete cleanCard.backups;

                return JSON.stringify(copy) === JSON.stringify(cleanCard);
            })) {
                game.log(`AI: Skipping already scored card ${card.name} [${index}]`, !this.logAction);
                return;
            }

            game.log(`AI: Playing ${card.name} (${index}) in the simulation`, !this.logAction);

            // Play card
            // TODO: This might cause an infinite loop for cards that have a different costtype
            simulation.player[card.costType] = this.plr[card.costType];
            let result = simulation.interact.doTurnLogic(index.toString());

            alreadyScored.push(card);

            if (result !== true && !(result instanceof Card) || typeof result === "string") {
                game.log(`AI: Invalid move: ${result}`, !this.logAction);
                return; // Invalid move
            }

            let score = this._evaluate(simulation) - baseline - lastScore;
            lastScore = score;

            if (score <= best_move[1]) {
                game.log(`AI: Worse score (${score.toPrecision(2)}) than previous (${best_move[1].toPrecision(2)})`, !this.logAction);
                return;
            }

            game.log(`AI: New best score (${score.toPrecision(2)}). Better than previous by ${(score - best_move[1]).toPrecision(2)}`, !this.logAction);

            // This card is now the best move
            best_move = [card, score];
        });*/
        let alreadyScored = [];
        
        this.plr.hand.forEach(card => {
            let index = this.plr.hand.indexOf(card);
            if (index === -1) return false;
            index += 1;

            // If that card is already scored, skip it
            if (alreadyScored.filter(c => c.name === card.name).some(c => {
                let copy = c.perfectCopy();

                delete copy.uuid;
                delete copy.plr;
                delete copy.backups;

                // Check if copy == card
                let cleanCard = card.perfectCopy();

                // @ts-ignore
                delete cleanCard.uuid;
                // @ts-ignore
                delete cleanCard.plr;
                // @ts-ignore
                delete cleanCard.backups;

                return JSON.stringify(copy) === JSON.stringify(cleanCard);
            })) {
                game.log(`AI: Skipping already scored card ${card.name} [${index}]`, !this.logAction);
                return;
            }

            let simulation = this._createSimulation();

            alreadyScored.push(card);
            game.log(`AI: Playing ${card.name} [${index}] in the simulation`, !this.logAction);

            // Play card
            let result = simulation.interact.doTurnLogic(index.toString());

            if (result !== true && !(result instanceof Card) || typeof result === "string") {
                game.log(`AI: Invalid move: ${result}`, !this.logAction);
                return; // Invalid move
            }

            let score = this._evaluate(simulation);

            if (score <= best_move[1]) {
                game.log(`AI: Worse score (${score.toPrecision(2)}) than previous (${best_move[1].toPrecision(2)})`, !this.logAction);
                return;
            }

            game.log(`AI: New best score (${score.toPrecision(2)}). Better than previous by ${(score - best_move[1]).toPrecision(2)}`, !this.logAction);

            // This card is now the best move
            best_move = [card, score];
        });

        this._restoreGame();

        let score = best_move[1];

        /**
         * @type {Card | string}
         */
        let bestMoveType = best_move[0];

        if (!bestMoveType) {
            // Couldn't play any cards
            if (this.canAttack) bestMoveType = "attack";

            // TODO: Add hero power
            // TODO: Add use locations

            else bestMoveType = "end";

            this.history.push({ type: "chooseMove", data: bestMoveType });
        } else if (bestMoveType instanceof Card) {
            this.history.push({ type: "chooseMove", data: [bestMoveType.name, score] });

            // @ts-ignore
            let card = this.plr.hand.find(c => c.uuid === bestMoveType.uuid);
            if (!card) throw game.functions.createAIError("choose_move_card_not_found", "card", card); // TODO: Implement this

            bestMoveType = (this.plr.hand.indexOf(card) + 1).toString();
        }

        if (bestMoveType === "end") {
            this.canAttack = true;
        }

        game.log(`AI: Chose ${bestMoveType} for ${score} points`, !this.logAction);

        return bestMoveType;
    }

    /**
     * 
     * @param {Card | Player} attacker 
     * @param {Card | Player} target 
     * @param {(Card | Player | null)[]} best_attack 
     * @param {Game} simulation
     * 
     * @returns {(Card | Player | number | null)[]}
     */
    _attackTarget(attacker, target, best_attack, simulation) {
        let health = target.getHealth();
        let abck, tbck;

        if (attacker.classType == "Card") abck = attacker.createBackup();
        if (target.classType == "Card") tbck = target.createBackup();
        
        let result = simulation.attack(attacker, target);
        if (result !== true) return best_attack; // Invalid attack

        let score = this._evaluate(simulation);

        if (attacker.classType == "Card") {
            if (!abck) throw game.functions.createAIError("attack_backup_undefined_at_attacker", "backup", abck)

            attacker.restoreBackup(attacker.backups[abck]);
            attacker.ready();
        }

        if (target.classType == "Card") {
            if (!tbck) throw game.functions.createAIError("attack_backup_undefined_at_target", "backup", tbck);

            target.restoreBackup(target.backups[tbck]);
        }
        else target.health = health;

        if (typeof best_attack[2] === "number" && score <= best_attack[2]) return best_attack;

        return [attacker, target, score];
    }

    /**
     * Makes the ai attack
     *
     * @returns {(Card | Player | null)[]} Attacker, Target
     */
    attack() {
        // FIXME: The ai doesn't attack.
        game.log("AI: Attacking...", !this.logAction);

        let simulation = this._createSimulation();

        let board = game.board;
        let thisboard = board[this.plr.id];
        let opboard = board[this.plr.getOpponent().id];

        /**
         * @type {(Card | Player | null)[]}
         */
        let best_attack = [];

        [...thisboard, this.plr].forEach(attacker => {
            // Validate attacker.
            // TODO: Move this into a function maybe
            if (attacker instanceof game.Player && !attacker.attack) return;
            if (attacker instanceof game.Card && (
                attacker.attackTimes <= 0 || 
                attacker.sleepy || 
                attacker.dormant || 
                (attacker.getAttack && !attacker.getAttack()))
            ) return;

            // Attack a taunt if it exists
            let taunts = opboard.filter(c => c.keywords.includes("Taunt"));
            if (taunts.length > 0) {
                let target = taunts[0];

                // @ts-ignore
                best_attack = this._attackTarget(attacker, target, best_attack, simulation);
                return;
            }

            [...opboard, this.plr.getOpponent()].forEach(target => {
                if (attacker.classType == "Card" && !attacker.canAttackHero && target.classType == "Player") return;
                if (target.classType == "Card" && target.keywords.includes("Stealth")) return;
                
                // @ts-ignore
                best_attack = this._attackTarget(attacker, target, best_attack, simulation);
            });
        });

        if (best_attack.length <= 0) {
            // No attacking
            best_attack = [null, null];
            this.canAttack = false;
        } else {
            best_attack = [best_attack[0], best_attack[1]];

            // Show the card's names, if they exist. Otherwise show the raw object
            let mapped = best_attack.map(e => {
                if (e instanceof Card) return e.name;
                else return e;
            });

            this.history.push({ type: "attack", data: mapped });
        }

        this._restoreGame();

        // Log the attack
        let names = best_attack.map(e => {
            if (e instanceof Card) return e.name;
            else return e;
        });
        game.log(`AI: Attacking ${names[1]} with ${names[0]}`, !this.logAction);

        return best_attack;
    }

    /**
     * @deprecated Do not use this. This only exists to warn you that this doesn't exist
     */
    legacy_attack_1() {
        game.input("WARNING: This AI model doesn't have a legacy attack. Please reset the `AIAttackModel` in the config back to -1.\n".yellow);
        return this.attack(); // Use the default attack model
    }

    /**
     * Makes the ai select a target.
     * 
     * @param {string} prompt The prompt to show the ai.
     * @param {Card | null} card If the ai should care about `This minion can't be targetted by spells or hero powers`.
     * @param {"friendly" | "enemy" | null} force_side The side the ai should be constrained to.
     * @param {"minion" | "hero" | null} force_class The type of target the ai should be constrained to.
     * @param {import("./types").SelectTargetFlags[]} flags Some flags
     * 
     * @returns {Card | Player | false} The target selected.
     */
    selectTarget(prompt, card, force_side, force_class, flags) {
        game.log("AI: Selecting a target...", !this.logAction);
        const fallback = () => {
            game.log("AI: Falling back...", !this.logAction);
            return this.backup_ai.selectTarget(prompt, card, force_side, force_class, flags);
        }

        // TODO: Handle if there is no card
        if (!card) return fallback();

        // If one of the cards keyword methods has the word `selectTarget` in it.
        /**
         * @type {(string | Function)[][]}
         */
        let functions = Object.entries(card.blueprint)
            .filter(e => e[1] instanceof Function);

        let func = functions.find(f => f[1].toString().includes("selectTarget"));
        if (!func) return fallback();

        let simulation = this._createSimulation();

        /**
         * @type {Player}
         */
        let plr = simulation["player" + (this.plr.id + 1)];

        /**
         * @type {Player}
         */
        let op = simulation["player" + (this.plr.getOpponent().id + 1)];
        
        let currboard = simulation.board[this.plr.id];
        let opboard = simulation.board[this.plr.getOpponent().id];

        /**
         * The targets that the ai can choose from
         * 
         * @type {(Card | Player)[]}
         */
        let targets = [
            plr,
            op,
            ...currboard,
            ...opboard
        ];

        if (force_side == "enemy") {
            game.functions.remove(targets, plr);

            // Remove the friendly minions
            targets = targets.filter(target => !(target instanceof Card) || !currboard.includes(target));
        }
        else if (force_side == "friendly") {
            game.functions.remove(targets, op);

            // Remove the enemy minions
            targets = targets.filter(target => !(target instanceof Card) || !opboard.includes(target));
        }

        if (force_class == "hero") {
            targets = targets.filter(t => t.classType == "Player");
        }
        else if (force_class == "minion") {
            targets = targets.filter(t => t.classType == "Card");
        }

        if (card.type == "Spell") targets = targets.filter(t => t.classType != "Card" || !t.keywords.includes("Elusive"));

        /**
         * @type {(Card | Player | number)[]}
         */
        let best_target = [];

        targets.forEach(target => {
            if (flags.includes("allow_locations") && target.classType == "Card" && target.type != "Location") return;

            const simulation = this._createSimulation();
            const chosen_card = card.perfectCopy();
            chosen_card.getInternalGame();
            
            // Simulate choosing that target.
            /**
             * @type {number[]}
             */
            let index = [];
            if (target instanceof Card) {
                if (currboard.includes(target)) index = [plr.id, currboard.indexOf(target)];
                if (opboard.includes(target)) index = [plr.getOpponent().id, opboard.indexOf(target)];
            }

            simulation.player.forceTarget = target;

            const funcError = () => {
                return game.functions.createAIError("selectTarget_invalid_func", "Function", func);
            }
            if (!func) throw funcError();
            let fn = func[0];
            if (!fn || typeof fn !== "string") throw funcError();

            const result = chosen_card.activate(fn);

            if (index.length > 1 && target instanceof Card) simulation.board[index[0]][index[1]] = target;
            simulation.player.forceTarget = null;
            
            if (result === -1 || result === false || result.includes(-1)) return;

            const score = this._evaluate(simulation);
            if (typeof best_target[1] === "number" && score <= best_target[1]) return;

            // This is the new best target
            best_target = [target, score];
        });
        this._restoreGame();
        new game.Card("Sheep", game.player1).getInternalGame();

        let mapped = best_target.map(t => {
            if (t instanceof Card) return t.name;
            else return t;
        });
        this.history.push({ type: "selectTarget", data: mapped });

        game.log(`AI: Selected ${mapped[0]}`, !this.logAction);

        if (best_target.length <= 0) {
            // No targets
            return false;
        }

        if (typeof best_target[0] === "number") throw game.functions.createAIError("selectTarget_invalid_return_target", "Card | Player", best_target[0]);

        return best_target[0];
    }

    /**
     * Choose the best minion to discover.
     * 
     * @param {Card[] | import("./types").Blueprint[]} cards The cards to choose from
     * 
     * @returns {Card} Result
     */
    discover(cards) {
        return this._selectFromCards(cards, "discover");
    }

    /**
     * Choose the best card to dredge.
     * 
     * @param {Card[]} cards The cards to choose from
     * 
     * @returns {Card} Result
     */
    dredge(cards) {
        return this._selectFromCards(cards, "dredge");
    }

    /**
     * Choose the best option from `options`
     * 
     * @param {string[]} options The options the ai can pick from
     *
     * @returns {number | null} The question chosen
     */
    chooseOne(options) {
        // TODO: Add this
        return this.backup_ai.chooseOne(options);
    }

    /**
     * Choose the best answer from `options`
     *
     * @param {string} prompt The prompt to show to the ai
     * @param {string[]} options The options the ai can pick from
     *
     * @returns {number | null} The index of the option chosen + 1
     */
    question(prompt, options) {
        // TODO: Add this
        return this.backup_ai.question(prompt, options);
    }

    /**
     * Choose yes or no based on the prompt
     *
     * @param {string} prompt The prompt to show to the ai
     *
     * @returns {boolean} `true` if "Yes", `false` if "No"
     */
    yesNoQuestion(prompt) {
        // TODO: Add this
        return this.backup_ai.yesNoQuestion(prompt);
    }

    /**
     * Returns if the ai wants `card` to be traded
     *
     * @param {Card} card The card to check
     *
     * @returns {boolean} If the card should be traded
     */
    trade(card) {
        // TODO: Add this
        return this.backup_ai.trade(card);
    }

    /**
     * Returns the list of cards the ai wants to mulligan.
     * 
     * @returns {string} The indexes of the cards to mulligan. Look in `Interact.mulligan` for more details.
     */
    mulligan() {
        // TODO: Add this
        return this.backup_ai.mulligan();
    }

    _selectFromCards(cards, history_name, care_about_mana = true) {
        // This is currently being used by discover and dredge.

        // This is awful, but this looks like a good template for the other ai methods.
        // FIXME: This function causes memory leaks.
        // ^^^^ It might just be horrendus performance.

        // Temp fix for the performance, this skips the first loop.
        if (true /* TEMP LINE */) care_about_mana = false;

        game.log("AI: Selecting a card...", !this.logAction);

        /**
         * @type {(Card | string | number)[]}
         */
        let best_card = [];

        cards.forEach(card => {
            // TODO: Maybe try to create as few simulations as possible.
            this._restoreGame();
            let simulation = this._createSimulation();

            // Find the simulation version of this ai's player.
            /**
             * @type {Player}
             */
            let simplr = simulation["player" + (this.plr.id + 1)];

            // If the card is a blueprint, turn it into a card.
            if (!card.__ids) card = new game.Card(card.name, this.plr);

            // The card is now always a card instance.

            // We don't care about mana, so give the player infinite mana.
            // TODO: There might be a better way, like setting the costtype to be something non-existant
            // but that might be patched out later so i don't want to rely on it.
            if (!care_about_mana) simplr[card.costType] = 999999;

            // Play the card
            // FIXME: Wave of Apathy made the score 4.440892098500626e-16
            // ^^^^ The score is messed up overall. It is always 5-digits????
            let result = simulation.playCard(card, simplr);

            // Invalid card
            if (result !== true && !(result instanceof Card) || typeof result === "string") {
                return;
            }

            let score = this._evaluate(simulation);
            if (typeof best_card[1] === "number" && score <= best_card[1]) return;

            // This card is now the best card
            best_card = [card, score];
        });

        // FIXME: Is this necessary after the last restore game in the loop above?
        this._restoreGame();

        let score = best_card[1];
        let card = best_card[0];

        // If a card wasn't chosen, choose the first card.
        if (!card) {
            // As a backup, do this process all again but this time we don't care about the cost of cards.
            // TODO: I'm not sure about this one. This looks like a nightmare on performance.
            if (care_about_mana) {
                game.log("AI: Chose invalid card. Trying again without mana...", !this.logAction);
                return this._selectFromCards(cards, history_name, false);
            }

            game.log("AI: Chose invalid card.", !this.logAction);

            // Choose the first discover card as the last resort.
            this.history.push({ type: history_name, data: null });
            return cards[0];
        }

        if (!(card instanceof Card)) throw game.functions.createAIError("selectFromCards_invalid_return_card", "Card", card);

        game.log(`AI: Chose ${card.name}`, !this.logAction);

        this.history.push({ type: history_name, data: [card.name, score] });

        return best_card;
    }

    /**
     * Evaluates the game
     * 
     * @param {Game} simulation
     * @param {boolean} [sentiment=true] If it should perform sentiment analysis on the card's desc.
     * 
     * @returns {number} The score
     */
    _evaluate(simulation, sentiment = true) {
        // TODO: Make this better
        game.log("AI: Evaluating game state...", !this.logAction);

        let simplayer = simulation["player" + (this.plr.id + 1)];

        let score = 0;
        const VALUE_BIAS = 0.1;

        simulation.board.forEach(c => {
            c.forEach(c => {
                let bias = (c.plr.id == this.plr.id) ? 1 : -1;
                let s = this._evaluateCard(c, sentiment);
                //if (bias == 1 && s < 0) s = 0;
                //if (bias == -1 && s > 0) s = -0;

                score += s * bias;
            });
        });

        [simulation.player1, simulation.player2].forEach(p => {
            Object.entries(p).forEach(e => {
                let [key, val] = e;
                if (typeof val !== "number") return;
                if (val == 0) return;
                if (["id", "mana"].includes(key)) return;

                if (["fatigue", "heroPowerCost", "overload"].includes(key)) val = -val;

                let bias = 1;
                if (p.id != this.plr.id) bias = -1;

                score += val * bias * VALUE_BIAS;
            });
        });

        score += simplayer.mana;
        score -= simplayer.getOpponent().mana;

        [simulation.player1, simulation.player2].forEach(p => {
            [p.deck.length, p.hand.length, p.quests.length, p.sidequests.length, p.secrets.length].forEach(val => {
                let bias = 1;
                if (p.id != this.plr.id) bias = -1;

                score += val * bias * VALUE_BIAS;
            });
        });

        game.log(`AI: Evaluation completed with a score of ${score}`, !this.logAction);

        return score;
    }

    /**
     * Evaluates a card
     * 
     * @param {Card} c The card
     * @param {boolean} [sentiment=true] If it should perform sentiment analysis on the card's description
     * 
     * @returns {number} The score
     */
    _evaluateCard(c, sentiment = true) {
        let score = 0;

        if (c.type == "Minion" || c.type == "Weapon") score += (c.getAttack() + c.getHealth()) * game.config.AIStatsBias;
        else score += game.config.AISpellValue * game.config.AIStatsBias; // If the spell value is 4 then it the same value as a 2/2 minion
        score -= c.mana * game.config.AIManaBias;

        c.keywords.forEach(() => score += game.config.AIKeywordValue);
        Object.values(c).forEach(c => {
            if (c instanceof Array && c[0] instanceof Function) score += game.config.AIFunctionValue;
        });

        if (sentiment) score += this.backup_ai.analyzePositive(c.desc || "");
        if (!c.desc) score -= game.config.AINoDescPenalty;

        return score;
    }

    /**
     * Creates and returns a simulation
     * 
     * @returns {Game} The simulation
     */
    _createSimulation() {
        // Make a deep copy of the current game
        // Don't copy these props
        // FIXME: Why. Gets caught in an infinite loop.
        // FIXME: Mana increases without turn ending.
        // FIXME: The ai cannot play cards.
        game.log("AI: Creating simulation...", !this.logAction);

        let count = 0;

        /**
         * @type {Game}
         */
        let simulation = lodash.cloneDeepWith(game, ()=>{count++});
        game.log(`AI: Cloned total ${count} nodes from rows`, !this.logAction);
        simulation.simulation = true; // Mark it as a simulation

        [...simulation.player1.deck, ...simulation.player1.hand, ...simulation.player2.deck, ...simulation.player2.hand, ...simulation.player.deck, ...simulation.player.hand, ...simulation.opponent.deck, ...simulation.opponent.hand].forEach(c => {
            c.plr = simulation["player" + (c.plr.id + 1)];
        });
        simulation.player.getInternalGame();
        new game.Card("Sheep", simulation.player).getInternalGame();

        set(simulation);
        simulation.interact.getInternalGame();
        simulation.functions.getInternalGame();

        game.log("AI: Simulation created", !this.logAction);

        return simulation;
    }

    /**
     * Restore the game
     */
    _restoreGame() {
        game.log("AI: Restoring game...", !this.logAction);

        set(game);
        game.interact.getInternalGame();
        game.functions.getInternalGame();

        game.log("AI: Game restored", !this.logAction);
    }
}

// FIXME: Ai gets stuck in infinite loop when using cathedral of atonement (location) | shadowcloth needle (0 attack wpn) | that minion has no attack.
class SentimentAI {
    /**
     * @param {Player} plr 
     */
    constructor(plr) {
        getInternalGame();


        /**
         * The history of the AI. Also known as its "logs".
         * 
         * @type {import("./types").AIHistory[]}
         */
        this.history = [];

        /**
         * Prevent the ai from doing the actions that are in this array
         * 
         * @type {string[]}
         */
        this.prevent = [];

        /**
         * The cards that the AI has played this turn
         * 
         * @type {Card[]}
         */
        this.cards_played_this_turn = [];

        /**
         * The locations that the AI has used this turn
         * 
         * @type {Card[]}
         */
        this.used_locations_this_turn = [];

        /**
         * The card that the AI has focused, and is trying to kill
         * 
         * @type {Card | null}
         */
        this.focus = null;

        /**
         * The player that the AI is playing for
         * 
         * @type {Player}
         */
        this.plr = plr;
    }

    /**
     * Calculate the best move and return the result.
     * 
     * This can return: A card to play, "hero power", "attack", "use" or "end"
     * 
     * @returns {Card | string} Result
     */
    chooseMove() {
        /**
         * @type {Card | "hero power" | "attack" | "use" | "end" | number | null}
         */
        let best_move;
        let best_score = -100000;

        // Look for highest score
        this.plr.hand.forEach(c => {
            let score = this.analyzePositiveCard(c);

            if (score <= best_score || c.mana > this.plr.mana || this.cards_played_this_turn.includes(c)) return;

            // If the card is a minion and the player doesn't have the board space to play it, ignore the card
            if (["Minion", "Location"].includes(c.type) && game.board[this.plr.id].length >= game.config.maxBoardSpace) return;

            // Prevent the ai from playing the same card they returned from when selecting a target
            let r = false;

            this.history.forEach((h, i) => {
                if (h.data instanceof Array && h.data[1] === "0,1" && this.history[i - 1].data[0] == c.name) r = true;
            });
            if (r) return;

            best_move = c;
            best_score = score;
        });

        // If a card wasn't chosen
        // @ts-ignore
        if (!best_move) {
            // See if can hero power
            if (this._canHeroPower()) best_move = "hero power";

            // See if can attack
            else if (this._canAttack()) best_move = "attack";

            // See if has location
            else if (this._canUseLocation()) best_move = "use";

            else best_move = "end";

            this.history.push({"type": "chooseMove", "data": best_move});
        }

        else if (best_move instanceof Card) {
            this.history.push({"type": "chooseMove", "data": [best_move.name, best_score]});

            this.cards_played_this_turn.push(best_move);

            best_move = this.plr.hand.indexOf(best_move) + 1;
        }

        if (best_move == "end") {
            this.history.forEach((h, i) => {
                if (h instanceof Array && h[0] == "selectTarget" && h[1] == "0,1") this.history[i].data = null;
            });

            this.cards_played_this_turn = [];
            this.used_locations_this_turn = [];
            this.prevent = [];
        }

        return best_move.toString();
    }

    /**
     * Checks if there are any minions that can attack on the ai's board
     *
     * @returns {boolean} Can attack
     */
    _canAttack() {
        if (this.prevent.includes("attack")) return false;

        let valid_attackers = game.board[this.plr.id].filter(m => this._canMinionAttack(m));

        return valid_attackers.length > 0;
    }

    /**
     * Returns if the ai can use their hero power
     *
     * @returns {boolean} Can use hero power
     */
    _canHeroPower() {
        if (this.prevent.includes("hero power")) return false;

        let enoughMana = this.plr.mana >= this.plr.heroPowerCost;
        let canUse = this.plr.canUseHeroPower;

        let canHeroPower = enoughMana && canUse;

        this.prevent.push("hero power"); // The ai has already used their hero power that turn.

        return canHeroPower;
    }

    /**
     * Returns if there are any location cards the ai can use.
     *
     * @returns {boolean}
     */
    _canUseLocation() {
        if (this.prevent.includes("use")) return false;

        let valid_locations = game.board[this.plr.id].filter(m => m.type == "Location" && m.cooldown == 0 && !this.used_locations_this_turn.includes(m));

        return valid_locations.length > 0;
    }

    /**
     * Returns if the minion specified can attack
     *
     * @param {Card} m The minion to check
     *
     * @returns {boolean} Can attack
     */
    _canMinionAttack(m) {
        let booleans = !m.sleepy && !m.frozen && !m.dormant;
        let numbers = m.getAttack() && m.attackTimes;

        return booleans && !!numbers;
    }

    /**
     * Returns if the minion specified is targettable
     *
     * @param {Card} m Minion to check
     *
     * @returns {boolean} If it is targettable
     */
    _canTargetMinion(m) {
        let booleans = !m.dormant && !m.immune && !m.keywords.includes("Stealth");

        return booleans;
    }

    // ATTACKING
    /**
     * Finds all possible trades for the ai and returns them
     *
     * @returns {[Card[][], Card[][]]} `Perfect Trades`: [[attacker, target], ...], `Imperfect Trades`: [[attacker, target], ...]
     */
    _attackFindTrades() {
        let perfect_trades = [];
        let imperfect_trades = [];

        let currboard = game.board[this.plr.id].filter(m => this._canMinionAttack(m));

        currboard.forEach(a => {
            let trades = [...perfect_trades, ...imperfect_trades];

            let score = this.analyzePositiveCard(a);
            if (score > game.config.AIProtectThreshold || trades.map(c => c[0]).includes(a)) return; // Don't attack with high-value minions.

            if (a.sleepy || a.attackTimes <= 0) return;

            let opboard = game.board[this.plr.getOpponent().id].filter(m => this._canTargetMinion(m));

            opboard.forEach(t => {
                trades = [...perfect_trades, ...imperfect_trades];
                if (trades.map(c => c[1]).includes(t)) return;

                let score = this.analyzePositiveCard(t);
                if (score < game.config.AIIgnoreThreshold) return; // Don't waste resources attacking useless targets.

                if (a.getAttack() == t.getHealth()) perfect_trades.push([a, t]);
                else if (a.getAttack() > t.getHealth()) imperfect_trades.push([a, t]);
            });
        });

        return [perfect_trades, imperfect_trades];
    }

    /**
     * Returns a score for the player specified based on how good their position is.
     *
     * @param {Player} player The player to score
     * @param {import("./types").ScoredCard[][]} board The board to check
     *
     * @returns {number} Score
     */
    _scorePlayer(player, board) {
        let score = 0;

        board[player.id].forEach(m => {
            score += m.score;
        });

        Object.entries(player).forEach(f => {
            let [key, val] = f;

            let i = ["health", "maxHealth", "armor", "maxMana"];
            if (!i.includes(key)) return;

            score += val;
        });

        score += player.deck.length;

        return score;
    }

    /**
     * Returns the player that is winning
     *
     * @param {import("./types").ScoredCard[][]} board The board to check
     *
     * @returns {[Player, number]} Winner, Score
     */
    _findWinner(board) {
        let score = this._scorePlayer(this.plr, board);
        let opScore = this._scorePlayer(this.plr.getOpponent(), board);

        let winner = (score > opScore) ? this.plr : this.plr.getOpponent();
        let s = (winner == this.plr) ? score : opScore;

        return [winner, s];
    }

    /**
     * Returns if there is a taunt on the board
     *
     * @param {boolean} [return_taunts=false] If the function should return the taunts it found, or just if there is a taunt. If this is true it will return the taunts it found.
     *
     * @returns {Card[] | boolean}
     */
    _tauntExists(return_taunts = false) {
        let taunts = game.board[this.plr.getOpponent().id].filter(m => m.keywords.includes("Taunt"));

        if (return_taunts) return taunts;

        return taunts.length > 0;
    }

    /**
     * Does a trade
     *
     * @returns {Card[] | null} Attacker, Target
     */
    _attackTrade() {
        let [perfect_trades, imperfect_trades] = this._attackFindTrades();

        let ret = null;
        if (perfect_trades.length > 0) ret = perfect_trades[0];
        else if (imperfect_trades.length > 0) ret = imperfect_trades[0];

        if (ret) this.history.push({"type": "trade", "data": [ret[0].name, ret[1].name]});

        return ret;
    }

    /**
     * Does a general attack
     *
     * @param {import("./types").ScoredCard[][]} board
     *
     * @returns {(Card | Player | -1)[]} Attacker, Target
     */
    _attackGeneral(board) {
        let current_winner = this._findWinner(board);

        let ret = null;

        // Risky
        let op_score = this._scorePlayer(this.plr.getOpponent(), board);
        let risk_mode = current_winner[1] >= op_score + game.config.AIRiskThreshold // If the ai is winner by more than 'threshold' points, enable risk mode

        let taunts = this._tauntExists(); // If there are taunts, override risk mode

        if (risk_mode && !taunts) ret = this._attackGeneralRisky();
        else ret = this._attackGeneralMinion();

        if (ret.includes(-1)) return [-1, -1];

        /**
         * @type {(Card | Player)[]}
         */
        // @ts-ignore - `ret` here is this type, but ts doesn't know it. So this is a workaround
        let returned = ret;

        this.history.push({"type": "attack", "data": [returned[0].name, returned[1].name]});

        // If the ai is not focusing on a minion, focus on the returned minion
        if (!this.focus && returned[1] instanceof game.Card) this.focus = returned[1];

        return returned;
    }

    /**
     * Does a risky attack.
     *
     * @returns {(Card | Player | -1)[]} Attacker, Target
     */
    _attackGeneralRisky() {
        // Only attack the enemy hero
        return [this._attackGeneralChooseAttacker(true), this.plr.getOpponent()];
    }

    /**
     * Chooses the attacker and target
     * 
     * Use the return value of this function to actually attack by passing it into `game.attack`
     *
     * @returns {(Card | Player | -1)[]} Attacker, Target
     */
    _attackGeneralMinion() {
        let target;

        // If the focused minion doesn't exist, select a new minion to focus
        if (!game.board[this.plr.getOpponent().id].find(a => a == this.focus)) this.focus = null;

        if (!this.focus || (this._tauntExists() && !this.focus.keywords.includes("Taunt"))) target = this._attackGeneralChooseTarget();
        else target = this.focus

        return [this._attackGeneralChooseAttacker(target instanceof game.Player), target];
    }

    /**
     * Choose a target for a general attack
     *
     * @returns {Card | Player | -1} Target | -1 (Go back)
     */
    _attackGeneralChooseTarget() {
        /**
         * @type {(Card | Player | number | null)[]}
         */
        let highest_score = [null, -9999];

        let board = game.board[this.plr.getOpponent().id];

        // If there is a taunt, select that as the target
        let taunts = this._tauntExists(true);
        if (taunts instanceof Array && taunts.length > 0) return taunts[0];

        board = board.filter(m => this._canTargetMinion(m));

        board.forEach(m => {
            if (typeof highest_score[1] !== "number") highest_score[1] = -9999;

            let score = this.analyzePositiveCard(m);
            if (score < highest_score[1]) return;

            highest_score = [m, score];
        });

        let target = highest_score[0];

        // TODO: Does this never fail?
        if (!target) return this.plr.getOpponent();

        if (!target) {
            this.prevent.push("attack");
            return -1;
        }

        // Only -1 is a valid number
        if (typeof target === "number" && target != -1) return -1;

        return target;
    }

    /**
     * Choose an attacker for a general attack
     *
     * @param {boolean} [target_is_player=false] If the target is a player
     *
     * @returns {Card | Player | -1} Attacker | -1 (Go back)
     */
    _attackGeneralChooseAttacker(target_is_player = false) {
        /**
         * @type {(Card | Player | number | null)[]}
         */
        let lowest_score = [null, 9999];

        let board = game.board[this.plr.id];
        board = board.filter(c => this._canMinionAttack(c));

        board.forEach(m => {
            if (typeof lowest_score[1] !== "number") lowest_score[1] = 9999;
            let score = this.analyzePositiveCard(m);

            if (score > lowest_score[1] || (score > game.config.AIProtectThreshold && !target_is_player)) return;

            if (m.sleepy || m.attackTimes <= 0) return;
            if (target_is_player && !m.canAttackHero) return;

            lowest_score = [m, score];
        });

        let attacker = lowest_score[0];

        // TODO: Does this never fail?
        if (!attacker && (this.plr.attack > 0 && this.plr.canAttack)) return this.plr;

        if (!attacker) {
            this.prevent.push("attack");
            return -1;
        }

        // Only -1 is a valid number
        if (typeof attacker === "number" && attacker != -1) return -1;

        return attacker;
    }

    /**
     * Makes the ai attack
     *
     * @returns {(Card | Player | -1)[]} Attacker, Target
     */
    attack() {
        // Assign a score to all minions
        /**
         * @type {import("./types").ScoredCard[][]}
         */
        let board = game.board.map(m => {
            return m.map(c => {
                return {"card": c, "score": this.analyzePositiveCard(c)};
            });
        });

        let amount_of_trades = this._attackFindTrades().map(t => t.length).reduce((a, b) => a + b);

        // The ai should skip the trade stage if in risk mode
        let current_winner = this._findWinner(board);
        let op_score = this._scorePlayer(this.plr.getOpponent(), board);
        let risk_mode = current_winner[1] >= op_score + game.config.AIRiskThreshold // If the ai is winner by more than 'threshold' points, enable risk mode

        let taunts = this._tauntExists();
        if (taunts) return this._attackGeneral(board); // If there is a taunt, attack it before trading

        if (amount_of_trades > 0 && !risk_mode) return this._attackTrade() ?? [-1, -1];
        return this._attackGeneral(board);
    }

    /**
     * Makes the ai attack
     * 
     * @deprecated Use `AI.attack` instead.
     * 
     * @returns {(Card | Player | -1)[]} Attacker, Target
     */
    legacy_attack_1() { // This gets called if you set the ai attack model to 1
        /**
         * @type {Card}
         */
        let worst_minion;
        let worst_score = 100000;
        
        game.board[this.plr.id].filter(m => !m.sleepy && !m.frozen && !m.dormant).forEach(m => {
            let score = this.analyzePositiveCard(m);

            if (score >= worst_score) return;

            worst_minion = m;
            worst_score = score;
        });

        /**
         * @type {Card | Player | -1}
         */
        // @ts-ignore
        let attacker = worst_minion;
        
        let targets;

        let best_minion;
        let best_score = -100000;

        // Check if there is a minion with taunt
        let taunts = game.board[this.plr.getOpponent().id].filter(m => m.keywords.includes("Taunt"));
        if (taunts.length > 0) targets = taunts.filter(m => !m.immune && !m.dormant);
        else targets = game.board[this.plr.getOpponent().id].filter(m => !m.immune && !m.dormant);

        targets.forEach(m => {
            let score = this.analyzePositiveCard(m);

            if (score <= best_score) return;

            best_minion = m;
            best_score = score;
        });
        
        /**
         * @type {Card | Player | null | -1}
         */
        // @ts-ignore
        let target = best_minion;

        // If the AI has no minions to attack, attack the enemy hero
        if (!target) {
            if (!taunts.length && attacker && attacker.canAttackHero) target = this.plr.getOpponent();
            else {
                attacker = -1;
                target = -1;

                this.prevent.push("attack");
            }
        }
        if (!attacker && (this.plr.attack > 0 && this.plr.canAttack)) attacker = this.plr;

        let arr = [];
        let strbuilder = "";

        if (attacker instanceof game.Player) arr.push("P" + (attacker.id + 1));
        else if (attacker instanceof game.Card) {
            arr.push(attacker.name);
            strbuilder += worst_score + ", ";
        }
            
        if (target instanceof game.Player) arr.push("P" + (target.id + 1));
        else if (target instanceof game.Card) {
            arr.push(target.name);
            strbuilder += best_score;
        }

        this.history.push({"type": `attack, [${strbuilder}]`, "data": arr});

        return [attacker, target];
    }
    // -------------

    /**
     * Makes the ai select a target.
     * 
     * Gets automatically called by `Interactive.selectTarget`, so use that instead.
     * 
     * @param {string} prompt The prompt to show the ai.
     * @param {Card | null} card The card that called this function
     * @param {"friendly" | "enemy" | null} [force_side=null] The side the ai should be constrained to.
     * @param {"minion" | "hero" | null} [force_class=null] The type of target the ai should be constrained to.
     * @param {import("./types").SelectTargetFlags[]} [flags=[]] Some flags
     * 
     * @returns {Card | Player | false} The target selected.
     */
    selectTarget(prompt, card, force_side = null, force_class = null, flags = []) {
        if (flags.includes("allow_locations") && force_class != "hero") {
            let locations = game.board[this.plr.id].filter(m => m.type == "Location" && m.cooldown == 0 && !this.used_locations_this_turn.includes(m));
            this.used_locations_this_turn.push(locations[0]);

            if (locations.length > 0) return locations[0];
        }

        let op = this.plr.getOpponent();
        let id = this.plr.id;

        let side = null;

        let score = this.analyzePositive(prompt, false);

        if (score > 0) side = "self";
        else if (score < 0) side = "enemy";

        if (force_side) side = force_side;

        let sid = (side == "self") ? id : op.id;

        if (game.board[sid].length <= 0 && force_class == "minion") {
            this.history.push({"type": "selectTarget", "data": "0,1"});

            return false;
        }

        if (force_class && force_class == "hero") {
            /**
             * @type {Player | false}
             */
            let ret = false;

            if (side == "self") ret = this.plr;
            else if (side == "enemy") ret = op;
            let _ret = (ret instanceof game.Player) ? "P" + (ret.id + 1) : ret;

            this.history.push({"type": "selectTarget", "data": _ret});

            return ret;
        }

        // The player has no minions, select their face
        if (game.board[sid].length <= 0) {
            /**
             * @type {Player | false}
             */
            let ret = false;

            if (force_class != "minion") {
                ret = game["player" + (sid + 1)];
                if (!ret) throw new Error("Player " + (sid + 1) + " not found");

                this.history.push({"type": "selectTarget", "data": "P" + (ret.id + 1)});
            }
            else this.history.push({"type": "selectTarget", "data": -1});

            return ret;
        }
        
        /**
         * @type {Card | false}
         */
        let best_minion;
        let best_score = -100000;

        game.board[sid].forEach(m => {
            if (!this._canTargetMinion(m)) return;
            if ((card && card.type == "Spell" && m.keywords.includes("Elusive")) || m.type == "Location") return;
            
            let s = this.analyzePositiveCard(m);

            if (s <= best_score) return;

            best_minion = m;
            best_score = s;
        });

        // @ts-ignore
        if (best_minion) {
            this.history.push({"type": "selectTarget", "data": `${best_minion.name},${best_score}`});

            return best_minion;
        }

        this.history.push({"type": "selectTarget", "data": -1});
        return false;
    }

    /**
     * Choose the "best" minion to discover.
     * 
     * @param {Card[] | import("./types").Blueprint[]} cards The cards to choose from
     * 
     * @returns {Card | null} Result
     */
    discover(cards) {
        /**
         * @type {Card | null}
         */
        let best_card;
        let best_score = -100000;

        // Look for highest score
        cards.forEach(c => {
            if (!c.name) return; // Card-like is invalid

            let score = this.analyzePositiveCard(new game.Card(c.name, this.plr));

            if (score <= best_score) return;

            best_card = c;
            best_score = score;
        });

        // @ts-ignore
        if (!best_card) return null;

        this.history.push({"type": "discover", "data": [best_card.name, best_score]});

        best_card = new game.Card(best_card.name, this.plr); // `cards` can be a list of blueprints, so calling best_card.imperfectCopy is dangerous

        return best_card;
    }

    /**
     * Choose the "best" card to dredge.
     * 
     * @param {Card[]} cards The cards to choose from
     * 
     * @returns {Card | null} Result
     */
    dredge(cards) {
        /**
         * @type {Card | null}
         */
        let best_card;
        let best_score = -100000;

        // Look for highest score
        cards.forEach(c => {
            let score = this.analyzePositiveCard(c);

            if (score <= best_score) return;

            best_card = c;
            best_score = score;
        });

        // @ts-ignore
        if (!best_card) return null;

        let name = best_card ? best_card.name : null

        this.history.push({"type": "dredge", "data": [name, best_score]});
        return best_card;
    }

    /**
     * Choose the "best" option from `options`
     * 
     * @param {string[]} options The options the ai can pick from
     *
     * @returns {number | null} The index of the question chosen
     */
    chooseOne(options) {
        // I know this is a bad solution
        // "Deal 2 damage to a minion; or Restore 5 Health."
        // ^^^^^ It will always choose to restore 5 health, since it sees deal 2 damage as bad but oh well, future me problem.
        // ^^^^^ Update 29/05/23  TODO: Fix this
        let best_choice = null;
        let best_score = -100000;
 
        // Look for highest score
        options.forEach((c, i) => {
            let score = this.analyzePositive(c);

            if (score <= best_score) return;

            best_choice = i;
            best_score = score;
        });
 
        this.history.push({"type": "chooseOne", "data": [best_choice, best_score]});

        return best_choice;
    }

    /**
     * Choose the "best" answer from `options`
     *
     * @param {string} prompt The prompt to show to the ai
     * @param {string[]} options The options the ai can pick from
     *
     * @returns {number | null} The index of the option chosen + 1
     */
    question(prompt, options) {
        let best_choice = null;
        let best_score = -100000;

        options.forEach((v, i) => {
            let score = this.analyzePositive(v);

            if (score <= best_score) return;

            best_choice = i;
            best_score = score;
        });

        this.history.push({"type": `question: ${prompt}`, "data": [best_choice, best_score]});

        if (!best_choice) return null;

        return best_choice + 1;
    }

    /**
     * Choose yes or no based on the prompt
     *
     * @param {string} prompt The prompt to show to the ai
     *
     * @returns {boolean} `true` if "Yes", `false` if "No"
     */
    yesNoQuestion(prompt) {
        let score = this.analyzePositive(prompt);
        let ret;

        if (score > 0) ret = true;
        else ret = false;

        this.history.push({"type": "yesNoQuestion", "data": [prompt, ret]});

        return ret;
    }

    /**
     * Returns if the ai wants `card` to be traded
     *
     * @param {Card} card The card to check
     *
     * @returns {boolean} If the card should be traded
     */
    trade(card) {
        if (this.plr.deck.length <= 1) return false; // If the ai doesn't have any cards to trade into, don't trade the card.
        if (this.plr.mana < 1) return false; // If the ai can't afford to trade, don't trade the card

        let score = this.analyzePositiveCard(card);

        let ret = score <= game.config.AITradeThreshold;

        this.history.push({"type": "trade", "data": [card.name, ret, score]});

        return ret;
    }

    /**
     * Returns the list of cards the ai wants to mulligan.
     * 
     * @returns {string} The indexes of the cards to mulligan. Look in `Interact.mulligan` for more details.
     */
    mulligan() {
        let to_mulligan = "";

        let _scores = "(";

        this.plr.hand.forEach(c => {
            if (c.name == "The Coin") return;

            let score = this.analyzePositiveCard(c);

            if (score < game.config.AIMulliganThreshold) to_mulligan += (this.plr.hand.indexOf(c) + 1).toString();

            _scores += `${c.name}:${score}, `;
        });

        _scores = _scores.slice(0, -2) + ")";

        this.history.push({"type": `mulligan (T${game.config.AIMulliganThreshold})`, "data": [to_mulligan, _scores]});

        return to_mulligan;
    }

    /**
     * Analyze a string and return a score based on how "positive" the ai thinks it is
     *
     * @param {string} str The string to analyze
     * @param {boolean} context Enable context analysis
     * 
     * @returns {number} The score the string gets
     */
    analyzePositive(str, context = true) {
        if (context) context = game.config.AIContextAnalysis;
        let score = 0;

        str.toLowerCase().split(/[^a-z0-9 ]/).forEach(i => {
            i = i.trim();

            i.split(" ").forEach(s => {
                // Filter out any characters not in the alphabet
                s = s.replace(/[^a-z]/g, "");
                let ret = false;

                Object.entries(game.config.AISentiments).forEach(v => {
                    if (ret) return;

                    Object.entries(v[1]).forEach(k => {
                        if (ret) return;

                        const k0 = k[0].replace(/^(.*)[sd]$/, "$1"); // Remove the last "s" or "d" in order to account for plurals 
                        if (!new RegExp(k[0]).test(s) && !new RegExp(k0).test(s)) return;

                        // If the sentiment is "positive", add to the score. If it is "negative", subtract from the score.
                        let opponent_test = /enemy|enemies|opponent/;
                        let pos = k[1];
                        if (context && opponent_test.test(i)) pos = -pos;
                        score -= (v[0] == "positive") ? -pos : pos;
                        ret = true;
                        return;
                    });
                });
            });
        });

        return score;
    }

    /**
     * Same as `analyzePositive` but changes the score based on a card's positive and negative values.
     * Passes the card's description into `analyzePositive`.
     *
     * @param {Card} c The card to analyze
     *
     * @returns {number} The score
     */
    analyzePositiveCard(c) {
        let score = this.analyzePositive(c.desc || "");

        if (c.type == "Minion" || c.type == "Weapon") score += (c.getAttack() + c.getHealth()) * game.config.AIStatsBias;
        else score += game.config.AISpellValue * game.config.AIStatsBias; // If the spell value is 4 then it the same value as a 2/2 minion
        score -= c.mana * game.config.AIManaBias;

        c.keywords.forEach(() => score += game.config.AIKeywordValue);
        Object.values(c).forEach(c => {
            if (c instanceof Array && c[0] instanceof Function) score += game.config.AIFunctionValue;
        });

        return score;
    }
}

exports.SimulationAI = SimulationAI;
exports.SentimentAI = SentimentAI;
