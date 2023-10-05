/**
 * Functions
 * @module Functions
 */

import {
    _deckcodeFunctions,
    _fsFunctions,
    _cardFunctions,
    _colorFunctions,
    _utilFunctions,
    _infoFunctions,
    _eventFunctions,
} from "../../internal.js";

export const functions = {
    // TODO: Create better docstrings. (remember to also change the docstrings for, for example, functions.card.vanilla)
    /**
     * Deckcode related functions
     */
    deckcode: _deckcodeFunctions,

    /**
     * File-system related functions
     */
    file: _fsFunctions,

    /**
     * Card related functions
     */
    card: _cardFunctions,

    /**
     * Color related functions
     */
    color: _colorFunctions,

    /**
     * Utility functions
     */
    util: _utilFunctions,

    /**
     * Info functions
     */
    info: _infoFunctions,

    /**
     * Event related functions
     */
    event: _eventFunctions,
}
