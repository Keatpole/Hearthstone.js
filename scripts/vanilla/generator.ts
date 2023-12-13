/**
 * Importing this module will reach out to an api and save the result to a file.
 * @module Vanilla Card Generator
 */

import { Buffer } from 'node:buffer';
import https from 'node:https';
import process from 'node:process';
import { type Card as VanillaCard } from '@hearthstonejs/vanillatypes';
import { createGame } from '../../src/internal.js';

const { game } = createGame();

// Copy-and-pasted from this stackoverflow answer:
// https://stackoverflow.com/a/62588602
function get(url: string, resolve: (value: unknown) => void, reject: (reason: any) => void): void {
    https.get(url, response => {
        // If any other status codes are returned, those needed to be added here
        if (response.statusCode === 301 || response.statusCode === 302) {
            if (!response.headers.location) {
                throw new Error('No redirect found. Something must be wrong with the api?');
            }

            get(response.headers.location, resolve, reject);
            return;
        }

        const body: any[] = [];

        response.on('data', chunk => {
            body.push(chunk);
        });

        response.on('end', () => {
            try {
                // Remove JSON.parse(...) for plain data
                resolve(JSON.parse(Buffer.concat(body).toString()));
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function getData(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        get(url, resolve, reject);
    });
}

async function main(): Promise<void> {
    await getData('https://api.hearthstonejson.com/v1/latest/enUS/cards.json').then(r => {
        let data = r as VanillaCard[];

        // Let data = JSON.parse(r);
        const oldLength = data.length;
        data = game.functions.card.vanilla.filter(data, false, false, true);

        game.functions.util.fs('write', '/vanillacards.json', JSON.stringify(data));

        const difference = oldLength - data.length;
        console.log('Found %s cards!\nFiltered away %s cards!\nSuccessfully imported %s cards!', oldLength, difference, data.length);

        process.exit(0);
    });
}

await main();
