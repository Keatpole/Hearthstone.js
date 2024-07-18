import type {
	Event,
	EventListenerCallback,
	TickHookCallback,
} from "@Game/types.js";

export const eventFunctions = {
	/**
	 * Add an event listener.
	 *
	 * @param key The event to listen for. If this is an empty string, it will listen for any event.
	 * @param callback The code that will be ran if the event listener gets triggered.
	 * @param lifespan How many times the event listener will trigger and call "callback" before self-destructing. Set this to -1 to make it last forever, or until it is manually destroyed using "callback".
	 *
	 * @returns If you call this function, it will destroy the event listener.
	 */
	addListener(
		key: Event | "",
		callback: EventListenerCallback,
		lifespan = 1,
	): () => boolean {
		let times = 0;

		const id = game.event.listenerCount;
		let alive = true;

		/**
		 * Destroys the eventlistener and removes it from the game event listeners.
		 *
		 * @returns Returns true if the object was successfully destroyed, false otherwise.
		 */
		const destroy = () => {
			if (!alive) {
				return false;
			}

			delete game.event.listeners[id];

			alive = false;
			return true;
		};

		game.event.listeners[id] = (_key, _unknownValue, eventPlayer) => {
			// Validate key. If key is empty, match any key.
			if (key !== "" && _key !== key) {
				return;
			}

			const message = callback(_unknownValue, eventPlayer);
			times++;

			switch (message) {
				case "destroy": {
					destroy();
					break;
				}

				case "reset": {
					times = 0;
					break;
				}

				case false: {
					times--;
					break;
				}

				case true: {
					break;
				}

				default: {
					break;
				}
			}

			if (times === lifespan) {
				destroy();
			}
		};

		game.event.listenerCount++;

		return destroy;
	},

	/**
	 * Hooks a callback function to the tick event.
	 *
	 * @param callback The callback function to be hooked.
	 *
	 * @returns A function that, when called, will remove the hook from the tick event.
	 */
	hookToTick(callback: TickHookCallback): () => void {
		game.event.tickHooks.push(callback);

		const unhook = () => {
			game.functions.util.remove(game.event.tickHooks, callback);
		};

		return unhook;
	},

	/**
	 * Suppresses the specified event key by adding it to the list of suppressed events.
	 *
	 * @param key The event key to be suppressed.
	 *
	 * @returns A function that undoes the suppression.
	 */
	suppress(key: Event): () => boolean {
		game.event.suppressed.push(key);

		/**
		 * Unsuppresses the event key.
		 */
		const unsuppress = () =>
			game.functions.util.remove(game.event.suppressed, key);

		return unsuppress;
	},

	/**
	 * Ignores suppression for the specified event key.
	 *
	 * @param key The event key to be forced.
	 *
	 * @returns A function that undoes this.
	 */
	ignoreSuppression(key: Event): () => boolean {
		game.event.forced.push(key);

		/**
		 * Stops ignoring suppressions for that key
		 */
		const undo = () => game.functions.util.remove(game.event.suppressed, key);

		return undo;
	},

	/**
	 * Executes the given callback while suppressing the specified key or keys.
	 *
	 * @param key The key or keys to suppress.
	 * @param callback The callback to execute.
	 *
	 * @returns The return value of the callback.
	 */
	withSuppressed<T>(key: Event | Event[], callback: () => T): T {
		const unsuppressed: Array<() => boolean> = [];

		if (Array.isArray(key)) {
			for (const _key of key) {
				unsuppressed.push(this.suppress(_key));
			}
		} else {
			unsuppressed.push(this.suppress(key));
		}

		const returnValue = callback();
		for (const unsuppress of unsuppressed) {
			unsuppress();
		}

		return returnValue;
	},
};
