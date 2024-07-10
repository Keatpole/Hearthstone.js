import { Rarity } from "@Game/types.js";
import chalk, { type ChalkInstance } from "chalk";
import stripAnsi from "strip-ansi";

export const colorFunctions = {
	/**
	 * If it should parse color tags (`<b>`)
	 */
	parseTags: true,

	/**
	 * Colors `text` based on `rarity`.
	 *
	 * @param str The string to color
	 * @param rarity The rarity
	 *
	 * @returns The colored string
	 *
	 * @example
	 * assert(card.rarity, "Legendary");
	 * assert(card.name, "Sheep");
	 *
	 * const colored = fromRarity(card.name, card.rarity);
	 * assert.equal(colored, chalk.yellow("Sheep"));
	 */
	fromRarity(text: string, rarity: Rarity): string {
		let newText = "";

		switch (rarity) {
			case Rarity.Free: {
				newText = text;
				break;
			}

			case Rarity.Common: {
				newText = `<gray>${text}</gray>`;
				break;
			}

			case Rarity.Rare: {
				newText = `<blue>${text}</blue>`;
				break;
			}

			case Rarity.Epic: {
				newText = `<bright:magenta>${text}</bright:magenta>`;
				break;
			}

			case Rarity.Legendary: {
				newText = `<yellow>${text}</yellow>`;
				break;
			}

			default: {
				throw new Error("Unknown rarity");
			}
		}

		return this.fromTags(newText);
	},

	/**
	 * Parses color tags in `text`.
	 *
	 * Look at the examples for some of the things you can do.
	 *
	 * Here are _some_ of the available tags:
	 *
	 * @example
	 * // You can combined these with each other
	 * // Many of these tags may not be supported by all terminal emulators / consoles.
	 * // The following terminals are tested:
	 * // Windows Terminal
	 * // Windows Command Prompt (doesn't support overline)
	 * // Windows Powershell (doesn't support overline)
	 *
	 * // Foreground
	 * '[fg:][dark:]red', '[fg:][dark:]green', '[fg:][dark:]blue' // (The `fg` and `dark` are both optional. For example: `fg:blue`)
	 *
	 * // Background
	 * 'bg:red', 'bg:green', 'bg:blue'
	 *
	 * // Bright
	 * 'bright:red', 'bright:green', 'bright:blue'
	 *
	 * // Background Bright
	 * 'bg:bright:red', 'bg:bright:green', 'bg:bright:blue'
	 *
	 * // Special
	 * 'b[old]', 'i[talic]', 'underline' // The `old` in bold and `talic` in italic are optional
	 *
	 * // Hex
	 * '[fg:]#FF0000', 'bg:#FF0000'
	 *
	 * // RGB
	 * '[fg:]rgb[:][(]255[ ],0[ ],0[)]', 'bg:rgb(255, 0, 0)' // E.g. rgb:(0, 0, 255). rgb:0,0,255). rgb:(0,0,255). rgb(0, 0, 255). bg:rgb(0, 0, 255)
	 *
	 * @param text The text to parse
	 *
	 * @returns The resulting string
	 *
	 * @example
	 * const parsed = fromTags("<b>Battlecry:</b> Test");
	 * assert.equal(parsed, chalk.bold("Battlecry:") + " Test");
	 *
	 * @example
	 * // Add the `~` character to escape the tag
	 * const parsed = fromTags("~<b>Battlecry:~</b> Test ~~<b>Test~~</b> Test");
	 * assert.equal(parsed, "<b>Battlecry:</b> Test ~" + chalk.bold("Test~") + " Test");
	 *
	 * @example
	 * // You can mix and match tags as much as you want. You can remove categories of tags as well, for example, removing `bg:bright:blue` by doing `</bg>`
	 * const parsed = fromTags("<red bg:bright:blue bold>Test</bg> Hi</b> there</red> again");
	 * assert.equal(parsed, chalk.red.bgBlueBright.bold("Test") + chalk.red.bold(" Hi") + chalk.red(" there") + " again");
	 *
	 * @example
	 * // Try to not use '</>' if you can help it. In this case, it is fine.
	 * const parsed = fromTags("<fg:red italic bg:#0000FF>Test</> Another test");
	 * assert.equal(parsed, chalk.red.italic.bgHex("#0000FF")("Test") + " Another test");
	 */
	fromTags(text: string): string {
		// TODO: Optimize perhaps. #333
		if (!this.parseTags) {
			return text;
		}

		// Don't waste resources if the string doesn't contain tags
		if (!text.includes("<") || !text.includes(">")) {
			return text;
		}

		let partOfRgb: number[] = [];

		const handleSpecialTags = (
			index: number,
			tag: string,
			returnValue: string,
			bg: boolean,
		): string => {
			let newTag = tag;

			const readNextType = (index: number): string => {
				if (index >= currentTypes.length - 1) {
					return "";
				}

				return currentTypes[index + 1];
			};

			// The type is part of an rgb value. Ignore it
			if (partOfRgb.includes(index)) {
				return returnValue;
			}

			newTag = newTag.toLowerCase();

			// Support for rgb values with spaces after the commas
			if (newTag.endsWith(")") && /rgb:?\(/.test(readNextType(index + 1))) {
				newTag = readNextType(index + 1) + readNextType(index) + newTag;
				partOfRgb.push(index + 1, index + 2);
			}

			// Hex
			if (newTag.startsWith("#")) {
				if (bg) {
					return chalk.bgHex(newTag)(returnValue);
				}

				return chalk.hex(newTag)(returnValue);
			}

			// RGB
			if (newTag.startsWith("rgb")) {
				newTag = newTag.replace(/rgb:?/, "");
				const [red, green, blue] = newTag
					.split(",")
					.map((s) => game.lodash.parseInt(s.replace(/[()]/, "")));

				if (bg) {
					return chalk.bgRgb(red, green, blue)(returnValue);
				}

				return chalk.rgb(red, green, blue)(returnValue);
			}

			return returnValue;
		};

		const applyColorFromTag = (
			index: number,
			tag: string,
			returnValue: string,
		): string => {
			let newTag = tag;

			// Remove `fg:` prefix
			if (newTag.startsWith("fg:")) {
				newTag = newTag.replace("fg:", "");
			}

			// Remove the `bg:` prefix
			let bg = false;
			if (newTag.startsWith("bg:")) {
				newTag = newTag.replace("bg:", "");
				bg = true;
			}

			// Remove the `bright:` prefix
			let bright = false;
			if (newTag.startsWith("bright:")) {
				newTag = newTag.replace("bright:", "");
				bright = true;
			}

			// Remove `dark:` prefix
			if (newTag.startsWith("dark:")) {
				newTag = newTag.replace("dark:", "");
			}

			let newReturnValue = handleSpecialTags(index, newTag, returnValue, bg);

			if (newReturnValue !== returnValue) {
				return newReturnValue;
			}

			// Here are the non-special color tags
			if (newTag === "reset") {
				currentTypes = [];
			}

			if (newTag === "b") {
				newTag = "bold";
			} else if (newTag === "i") {
				newTag = "italic";
			}

			let tagFuncString = bg ? `bg${game.lodash.capitalize(newTag)}` : newTag;
			tagFuncString = bright ? `${tagFuncString}Bright` : tagFuncString;

			const callback = chalk[tagFuncString as keyof ChalkInstance] as unknown;
			if (callback instanceof Function) {
				newReturnValue = (callback as (...text: unknown[]) => string)(
					newReturnValue,
				);
			}

			return newReturnValue;
		};

		/**
		 * Appends text styling based on the current types.
		 *
		 * @param c The text to be styled
		 * @returns The text with applied styling
		 */
		const appendTypes = (c: string): string => {
			let returnValue = c;

			/*
			 * This line fixes a bug that makes, for example, `</b>Test</b>.` make the `.` be red when it should be white. This bug is why all new battlecries were `<b>Battlecry:</b> Deal...` instead of `<b>Battlecry: </b>Deal...`. I will see which one i choose in the future.
			 * Update: I discourge the use of `reset` now that you cancel tags manually. Use `</>` instead.
			 */
			if (currentTypes.includes("reset")) {
				currentTypes = ["reset"];
			}

			for (const [index, tag] of currentTypes.reverse().entries()) {
				returnValue = applyColorFromTag(index, tag, returnValue);
			}

			return returnValue;
		};

		let strbuilder = "";
		let wordStringbuilder = "";
		let currentTypes: string[] = [];

		let tagbuilder = "";
		let readingTag = false;
		let removeTag = false;

		const readPrevious = (i: number) => {
			if (i <= 0) {
				return "";
			}

			return text[i - 1];
		};

		const cancelled = (i: number): boolean => {
			const one = readPrevious(i);
			const two = readPrevious(i - 1);

			if (two === "~") {
				return false;
			}

			return one === "~";
		};

		// Loop through the characters in str
		for (const [index, character] of [...text].entries()) {
			if (cancelled(index)) {
				wordStringbuilder += character;
				continue;
			}

			if (character === "~") {
				continue;
			}

			if (character === "<" && !readingTag) {
				// Start a new tag
				strbuilder += appendTypes(wordStringbuilder);
				wordStringbuilder = "";

				readingTag = true;
			} else if (character === ">" && readingTag) {
				// End tag reading
				readingTag = false;

				const currentTags = tagbuilder.split(" ");
				tagbuilder = "";

				partOfRgb = [];

				if (!removeTag) {
					currentTypes.push(...currentTags);
					continue;
				}

				// Remove the tags
				removeTag = false;

				// If the tag is </>, remove all tags
				if (readPrevious(index) === "/") {
					currentTypes = [];
					continue;
				}

				for (const tag of currentTags) {
					const success = game.functions.util.remove(currentTypes, tag);
					if (success) {
						continue;
					}

					currentTypes = currentTypes.filter((type) => !type.startsWith(tag));
				}
			} else if (
				character === "/" &&
				readingTag &&
				readPrevious(index) === "<"
			) {
				removeTag = true;
			} else if (readingTag) {
				tagbuilder += character;
			} else {
				wordStringbuilder += character;
			}
		}

		strbuilder += appendTypes(wordStringbuilder);

		return strbuilder;
	},

	/**
	 * Generates a colored text based on a condition.
	 *
	 * @param condition Determines whether to apply the color.
	 * @param color The color to apply to the text.
	 * @param text The text to be colored.
	 */
	if(condition: boolean, color: string, text: string): string {
		return condition ? `<${color}>${text}</${color}>` : `<gray>${text}</gray>`;
	},

	/**
	 * Removes color tags from a string. Look in `parseTags` for more information.
	 *
	 * This only removes the TAGS, not the actual colors.
	 *
	 * @example
	 * const str = "<b>Hello</b>";
	 *
	 * assert.equal(stripTags(str), "Hello");
	 */
	stripTags(text: string): string {
		let newText: string;

		/*
		 * Regular expressions created by AIs, it removes the "<b>"'s but keeps the "~<b>"'s since the '~' here works like an escape character.
		 * It does however remove the escape character itself.
		 * Remove unescaped tags
		 */
		newText = text.replaceAll(/(?<!~)<.+?>/g, "");

		// Remove escape character
		newText = newText.replaceAll(/~(<.+?>)/g, "$1");

		return newText;
	},

	/**
	 * Removes ansi color codes from a string.
	 */
	stripColors(text: string): string {
		return stripAnsi(text);
	},

	/**
	 * Removes both color tags and ansi codes from a string.
	 */
	stripAll(text: string): string {
		return this.stripColors(this.stripTags(text));
	},
};
