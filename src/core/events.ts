import {type EventKey, type EventManagerEvents, type HistoryKey, type QuestType, type TickHookCallback, type UnknownEventValue} from '@Game/types.js';
import {Card, Player} from '../internal.js';

type EventManagerType = {
    eventListeners: number;
    tickHooks: TickHookCallback[];
    history: Record<number, HistoryKey[]>;
    events: EventManagerEvents;
    suppressed: EventKey[];
    forced: EventKey[];
    stats: Record<string, [number, number]>;

    tick(key: EventKey, value: UnknownEventValue, player: Player): boolean;
    cardUpdate(key: EventKey, value: UnknownEventValue, player: Player): boolean;
    questUpdate(questsName: 'secrets' | 'sidequests' | 'quests', key: EventKey, value: UnknownEventValue, plr: Player): boolean;
    broadcast(key: EventKey, value: UnknownEventValue, plr: Player, updateHistory?: boolean): boolean;
    addHistory(key: EventKey, value: UnknownEventValue, plr: Player): void;
    broadcastDummy(plr: Player): boolean;
    increment(player: Player, key: string, amount?: number): number;
};

export const eventManager: EventManagerType = {
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

    /**
     * A list of event keys to suppress.
     *
     * If an event with a key in this list is broadcast, it will add it to the history, and tick the game, but will not activate any passives / event listeners.
     */
    suppressed: [],

    /**
     * A list of event keys to never suppress.
     */
    forced: [],

    /**
     * Some general stats for each player.
     */
    stats: {},

    /**
     * Tick the game
     *
     * @param key The key of the event that triggered the tick
     * @param val The value of the event that triggered the tick
     * @param player The player that triggered the tick
     */
    tick(key, value, player) {
        // The code in here gets executed very often
        // So don't do any expensive stuff here

        // Infuse
        if (key === 'KillMinion') {
            // TODO: Rewrite and move this code. #329
            for (const p of player.hand) {
                const number_ = p.getKeyword('Infuse') as number | undefined;
                if (!number_) {
                    continue;
                }

                if (number_ <= 0) {
                    continue;
                }

                p.setKeyword('Infuse', number_ - 1);
                if (number_ - 1 > 0) {
                    continue;
                }

                p.activate('infuse');
            }
        }

        for (let i = 0; i < 2; i++) {
            const plr = game.functions.util.getPlayerFromId(i);

            // Activate spells in the players hand
            for (const card of plr.hand) {
                if (!(card instanceof Card)) {
                    throw new TypeError('Hand contains a non-card');
                }

                if (card.getHealth() <= 0) {
                    continue;
                }

                card.condition();

                // Just in case. Remove for small performance boost
                card.applyEnchantments();

                card.activate('handtick', key, value, player);
                if (card.cost < 0) {
                    card.cost = 0;
                }
            }

            for (const card of game.board[i]) {
                if (card.type === 'Minion' && card.getHealth() <= 0) {
                    continue;
                }

                card.activate('tick', key, value, player);
            }
        }

        for (const hook of this.tickHooks) {
            hook(key, value, player);
        }

        return true;
    },

    /**
     * Do card passives
     *
     * @param key The key of the event
     * @param val The value of the event
     * @param player The player that triggered the event
     *
     * @returns Success
     */
    cardUpdate(key, value, player) {
        for (const p of game.board) {
            for (const m of p) {
                // This function gets called directly after a minion is killed.
                if (m.getHealth() <= 0) {
                    continue;
                }

                m.activate('passive', key, value, player);
            }
        }

        for (let i = 0; i < 2; i++) {
            const plr = game.functions.util.getPlayerFromId(i);

            // Activate spells in the players hand
            for (const c of plr.hand) {
                c.activate('handpassive', key, value, player);

                if (c.type !== 'Spell') {
                    continue;
                }

                c.activate('passive', key, value, player);
            }

            const wpn = plr.weapon;
            if (!wpn) {
                continue;
            }

            wpn.activate('passive', key, value, player);
        }

        game.triggerEventListeners(key, value, player);
        return true;
    },

    /**
     * Update quests and secrets
     *
     * @param questsName The type of quest to update
     * @param key The key of the event
     * @param val The value of the event
     * @param plr The owner of the quest
     *
     * @returns Success
     */
    questUpdate(questsName, key, value, plr) {
        for (const s of plr[questsName]) {
            const quest: QuestType = s;

            if (quest.key !== key) {
                continue;
            }

            const [current, max] = quest.progress;

            const done = current + 1 >= max;
            if (!quest.callback(value, done)) {
                continue;
            }

            quest.progress[0]++;

            if (!done) {
                continue;
            }

            // The quest/secret is done
            plr[questsName].splice(plr[questsName].indexOf(quest), 1);

            if (questsName === 'secrets') {
                game.pause('\nYou triggered the opponents\'s \'' + quest.name + '\'.\n');
            }

            if (quest.next) {
                new Card(quest.next, plr).activate('cast');
            }
        }

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
    broadcast(key, value, plr, updateHistory = true) {
        this.tick(key, value, plr);

        if (updateHistory) {
            // Clone the value if it is a card.
            let historyValue = value;
            if (value instanceof Card) {
                historyValue = value.perfectCopy();
                historyValue.uuid = value.uuid;
            }

            this.addHistory(key, historyValue, plr);
        }

        // Check if the event is suppressed
        if (this.suppressed.includes(key) && !this.forced.includes(key)) {
            return false;
        }

        if (!(plr instanceof Player) || plr.id === -1) {
            return false;
        }

        if (!this.events[key]) {
            this.events[key] = [[['GameLoop', game.turns]], [['GameLoop', game.turns]]];
        }

        this.events[key]![plr.id].push([value, game.turns]);

        this.cardUpdate(key, value, plr);

        this.questUpdate('secrets', key, value, plr.getOpponent());
        this.questUpdate('sidequests', key, value, plr);
        this.questUpdate('quests', key, value, plr);

        return true;
    },

    /**
     * Write an event to history. Done automatically by `broadcast`.
     *
     * @param key The key of the event
     * @param val The value of the event
     * @param plr The player who caused the event to happen
     */
    addHistory(key, value, plr) {
        if (!this.history[game.turns]) {
            this.history[game.turns] = [['GameLoop', `Init ${key}`, plr]];
        }

        this.history[game.turns].push([key, value, plr]);
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
        return this.broadcast('Dummy', undefined, plr, false);
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
        if (!this.stats[key]) {
            this.stats[key] = [0, 0];
        }

        this.stats[key][player.id] += amount;

        return this.stats[key][player.id];
    },
};
