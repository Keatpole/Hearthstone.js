import { describe, expect, test } from "bun:test";
import { cardFunctions } from "@Game/internal.js";
import { Class, Tribe } from "@Game/types.js";

/*
 * Need to create a game in case the functions need it
 * This is a pretty big performance hit.
 */
// createGame();

describe("src/core/functions/card", () => {
	test.todo("vanilla > getAll", async () => {
		expect(false).toEqual(true);
	});

	test.todo("vanilla > filter", async () => {
		expect(false).toEqual(true);
	});

	test("validateClasses", async () => {
		expect(cardFunctions.validateClasses([Class.Mage], Class.Druid)).toEqual(
			false,
		);
		expect(cardFunctions.validateClasses([Class.Mage], Class.Mage)).toEqual(
			true,
		);
		expect(
			cardFunctions.validateClasses([Class.Mage, Class.Druid], Class.Druid),
		).toEqual(true);
		expect(cardFunctions.validateClasses([Class.Neutral], Class.Druid)).toEqual(
			true,
		);
	});

	test("matchTribe", async () => {
		expect(cardFunctions.matchTribe(Tribe.Beast, Tribe.Demon)).toEqual(false);
		expect(cardFunctions.matchTribe(Tribe.Beast, Tribe.Beast)).toEqual(true);
		expect(cardFunctions.matchTribe(Tribe.All, Tribe.Beast)).toEqual(true);
		// TODO: Should this return true?
		expect(cardFunctions.matchTribe(Tribe.Beast, Tribe.All)).toEqual(false);
	});

	test.todo("runBlueprintValidator", async () => {
		expect(false).toEqual(true);
	});

	test.todo("getClasses", async () => {
		expect(false).toEqual(true);
	});

	test("galakrondFormula", async () => {
		expect(cardFunctions.galakrondFormula(0)).toEqual(1);
		expect(cardFunctions.galakrondFormula(1)).toEqual(1);
		expect(cardFunctions.galakrondFormula(2)).toEqual(2);
		expect(cardFunctions.galakrondFormula(3)).toEqual(2);
		expect(cardFunctions.galakrondFormula(4)).toEqual(4);
		expect(cardFunctions.galakrondFormula(5)).toEqual(4);
		expect(cardFunctions.galakrondFormula(6)).toEqual(4);
	});

	test.todo("validateBlueprint", async () => {
		expect(false).toEqual(true);
	});

	test.todo("generateIdsFile", async () => {
		expect(false).toEqual(true);
	});
});
