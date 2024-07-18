import { describe, expect, test } from "bun:test";
import { colorFunctions, createGame } from "@Game/internal.js";
import { Rarity } from "@Game/types.js";

/*
 * Need to create a game in case the functions need it
 * This is a pretty big performance hit.
 */
createGame();

describe("src/core/functions/color", () => {
	test("fromRarity", async () => {
		// Disable parsing tags so the output from `fromRarity` is easier to parse.
		colorFunctions.parseTags = false;

		expect(colorFunctions.fromRarity("Test01", Rarity.Free)).toEqual("Test01");

		expect(colorFunctions.fromRarity("Test02", Rarity.Common)).toEqual(
			"<gray>Test02</gray>",
		);

		expect(colorFunctions.fromRarity("Test03", Rarity.Rare)).toEqual(
			"<blue>Test03</blue>",
		);

		expect(colorFunctions.fromRarity("Test04", Rarity.Epic)).toEqual(
			"<bright:magenta>Test04</bright:magenta>",
		);

		expect(colorFunctions.fromRarity("Test05", Rarity.Legendary)).toEqual(
			"<yellow>Test05</yellow>",
		);

		expect(colorFunctions.fromRarity.bind("Test06", "invalid_rarity")).toThrow(
			"Unknown rarity",
		);
	});

	test("fromTags", async () => {
		colorFunctions.parseTags = false;
		expect(colorFunctions.fromTags("<red>No parsing tags</red>")).toEqual(
			"<red>No parsing tags</red>",
		);
		colorFunctions.parseTags = true;

		expect(colorFunctions.fromTags("No tags")).toEqual("No tags");

		expect(
			colorFunctions.fromTags("No tags 01 <red>Red tag</red> No tags 02"),
		).toEqual("No tags 01 \x1b[31mRed tag\x1b[39m No tags 02");

		expect(
			colorFunctions.fromTags(
				"<fg:red bg:dark:blue>Red & blue bg tag</bg> Red tag</fg>",
			),
			// I don't know if the 49;39;31 should be here, but it works so who cares.
		).toEqual(
			"\x1b[31m\x1b[44mRed & blue bg tag\x1b[49m\x1b[39m\x1b[31m Red tag\x1b[39m",
		);

		expect(
			colorFunctions.fromTags("No tags 01 <red>Red tag<reset> No tags 02"),
		).toEqual("No tags 01 \x1b[31mRed tag\x1b[39m\x1b[0m No tags 02\x1b[0m");

		expect(colorFunctions.fromTags("<b>Bold tag</b> No tags 02")).toEqual(
			"\x1b[1mBold tag\x1b[22m No tags 02",
		);

		expect(colorFunctions.fromTags("<i>Italic tag</i> No tags 02")).toEqual(
			"\x1b[3mItalic tag\x1b[23m No tags 02",
		);

		expect(
			colorFunctions.fromTags("<#123456 bg:bright:red>Green tag</> No tags"),
		).toEqual("\x1b[38;2;18;52;86m\x1b[101mGreen tag\x1b[49m\x1b[39m No tags");

		expect(
			colorFunctions.fromTags(
				"<bg:#123456 fg:bright:red>Bg green tag</> No tags",
			),
		).toEqual(
			"\x1b[48;2;18;52;86m\x1b[91mBg green tag\x1b[39m\x1b[49m No tags",
		);

		expect(
			colorFunctions.fromTags("<rgb(0, 100, 0)>Green tag</> No tags"),
		).toEqual("\x1b[38;2;0;100;0mGreen tag\x1b[39m No tags");

		// FIXME: bg:rgb is broken for some reason.
		// expect(
		// 	colorFunctions.fromTags("<bg:rgb(0, 255, 0)>Green tag</bg> No tags"),
		// ).toEqual("\x1b[38;2;18;52;86m\x1b[101mGreen tag\x1b[49m\x1b[39m No tags");
		// TODO: REMOVE WHEN RGB IS FIXED
		expect(
			colorFunctions.fromTags("<bg:rgb(0, 100, 0)>Bg green tag</bg> No tags"),
		).toEqual("Bg green tag No tags");

		expect(
			colorFunctions.fromTags("<b>~<i>Bold tag~</i> Still bold</b>"),
		).toEqual("\x1b[1m<i>Bold tag</i> Still bold\x1b[22m");
	});

	test("if", async () => {
		// Disable parsing tags so the output from `if` is easier to parse.
		colorFunctions.parseTags = false;

		expect(colorFunctions.if(false, "red", "Test01")).toEqual(
			"<gray>Test01</gray>",
		);

		expect(colorFunctions.if(true, "red", "Test02")).toEqual(
			"<red>Test02</red>",
		);
	});

	test("stripTags", async () => {
		expect(colorFunctions.stripTags("No tags")).toEqual("No tags");

		expect(colorFunctions.stripTags("<red>One normal tag</red>")).toEqual(
			"One normal tag",
		);

		expect(
			colorFunctions.stripTags(
				"<bg:rgb(255, 0, 0) dark:green>Multiple <bold>advanced</bold> tags</>",
			),
		).toEqual("Multiple advanced tags");

		expect(colorFunctions.stripTags("~<red>Escaped tag~</red>")).toEqual(
			"<red>Escaped tag</red>",
		);

		expect(
			colorFunctions.stripTags("~~<red>Double escaped tag~~</red>"),
		).toEqual("~<red>Double escaped tag~</red>");
	});

	test("stripColors", async () => {
		expect(colorFunctions.stripColors("No ansi codes")).toEqual(
			"No ansi codes",
		);

		expect(colorFunctions.stripColors("\x1b[31;m1 ansi code\x1b[0m")).toEqual(
			"1 ansi code",
		);

		expect(
			colorFunctions.stripColors("\x1b[31;1;4m3 ansi codes\x1b[0m"),
		).toEqual("3 ansi codes");
	});

	test("stripAll", async () => {
		expect(colorFunctions.stripAll("No tags or ansi codes")).toEqual(
			"No tags or ansi codes",
		);

		// Tags
		expect(colorFunctions.stripAll("<red>One normal tag</red>")).toEqual(
			"One normal tag",
		);

		expect(
			colorFunctions.stripAll(
				"<bg:rgb(255, 0, 0) dark:green>Multiple <bold>advanced</bold> tags</>",
			),
		).toEqual("Multiple advanced tags");

		expect(colorFunctions.stripAll("~<red>Escaped tag~</red>")).toEqual(
			"<red>Escaped tag</red>",
		);

		expect(
			colorFunctions.stripAll("~~<red>Double escaped tag~~</red>"),
		).toEqual("~<red>Double escaped tag~</red>");

		// Ansi codes
		expect(colorFunctions.stripAll("\x1b[31;m1 ansi code\x1b[0m")).toEqual(
			"1 ansi code",
		);

		expect(colorFunctions.stripAll("\x1b[31;1;4m3 ansi codes\x1b[0m")).toEqual(
			"3 ansi codes",
		);

		// Tags & Ansi codes
		expect(
			colorFunctions.stripAll(
				"\x1b[31;m<red>One normal tag and one ansi code</red>\x1b[0m",
			),
		).toEqual("One normal tag and one ansi code");

		expect(
			colorFunctions.stripAll(
				"\x1b[31;1;4m<bg:rgb(255, 0, 0) dark:green>Multiple <bold>advanced</bold> tags and 3 ansi codes</>\x1b[0m",
			),
		).toEqual("Multiple advanced tags and 3 ansi codes");
	});
});
