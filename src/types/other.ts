import type { Card, Player } from "@Game/internal.js";
import type { Blueprint, Event } from "@Game/types.js";

/**
 * Game.PlayCard return value
 */
export type GamePlayCardReturn =
	| true
	| "cost"
	| "traded"
	| "forged"
	| "space"
	| "magnetize"
	| "colossal"
	| "refund"
	| "counter"
	| "invalid";

/**
 * Attack return value
 */
export type GameAttackReturn =
	| true
	| "divineshield"
	| "taunt"
	| "stealth"
	| "frozen"
	| "playernoattack"
	| "noattack"
	| "playerhasattacked"
	| "hasattacked"
	| "sleepy"
	| "cantattackhero"
	| "immune"
	| "dormant"
	| "titan"
	| "invalid";

/**
 * ExportDeck error return value
 */
export type FunctionsExportDeckError =
	| undefined
	| {
			msg: string;
			info: undefined | { card?: CardLike; amount?: number };
			recoverable: boolean;
	  };

/**
 * CalcMove return value
 */
export type AiCalcMoveOption = Card | "hero power" | "attack" | "use" | "end";

/**
 * SelectTarget alignment
 */
export type SelectTargetAlignment = "friendly" | "enemy" | "any";
/**
 * SelectTarget class
 */
export type SelectTargetClass = "hero" | "minion" | "any";
/**
 * SelectTarget flags
 */
export type SelectTargetFlag = "allowLocations" | "forceElusive";

export type CommandList = Record<
	string,
	(
		args: string[],
		flags?: { echo?: boolean; debug?: boolean },
	) => string | boolean
>;

/**
 * A card-like object.
 */
export type CardLike = Card | Blueprint;
/**
 * A target.
 */
export type Target = Card | Player;

/**
 * AI history object.
 */
export type AiHistory = {
	type: string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	data: any;
};

export type Todo = {
	state:
		| "not done"
		| "doing"
		| "done"
		| "first pass"
		| "second pass"
		| "third pass";
	description: string;
	issue: number;
};

/**
 * Game configuration.
 */
export type GameConfig = {
	general: {
		locale: string;
		debug: boolean;
		editor: string;
		topicBranchWarning: boolean;
		maxBoardSpace: number;
		maxHandLength: number;
	};

	decks: {
		validate: boolean;
		minLength: number;
		maxLength: number;
		maxOfOneCard: number;
		maxOfOneLegendary: number;
	};

	ai: {
		player1: boolean;
		player2: boolean;

		contextAnalysis: boolean;
		attackModel: number;
		mulliganThreshold: number;
		tradeThreshold: number;
		statsBias: number;
		costBias: number;
		spellValue: number;
		keywordValue: number;
		abilityValue: number;

		protectThreshold: number;
		ignoreThreshold: number;
		riskThreshold: number;

		sentiments: {
			positive: Record<string, number>;
			negative: Record<string, number>;
		};
	};

	advanced: {
		debugCommandPrefix: string;
		spawnInDiyCards: boolean;
		diyCardSpawnChance: number;
		dcShowUncollectible: boolean;
		getReadableCardMaxDepth: number;
		getReadableCardNoRecursion: boolean;
		getReadableCardAlwaysShowFullCard: boolean;

		forgetfulRandomTargetFailAmount: number;

		whitelistedHistoryKeys: Event[];
		hideValueHistoryKeys: Event[];
	};

	info: {
		versionText: string;

		stableIntroText: string;
		betaIntroText: string;
		alphaIntroText: string;
		topicIntroText: string;

		githubUrl: string;
	};

	todo: Record<string, Todo>;
};
