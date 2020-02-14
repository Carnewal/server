import * as net from 'net';
import yargs from 'yargs';
import { watch } from 'chokidar';

import { RsBuffer } from './net/rs-buffer';
import { World } from './world/world';
import { ClientConnection } from './net/client-connection';
import { logger } from '@runejs/logger';
import { GameCache } from '@runejs/cache-parser';
import { NpcActionPlugin, setNpcPlugins } from '@server/world/mob/player/action/npc-action';
import { ObjectActionPlugin, setObjectPlugins } from '@server/world/mob/player/action/object-action';
import { loadPlugins } from '@server/plugins/plugin-loader';

const GAME_SERVER_PORT = 43594;
export let gameCache;
export let world;

export async function injectPlugins(): Promise<void> {
    await loadPlugins<NpcActionPlugin>('npc-plugin').then(plugins => setNpcPlugins(plugins));
    await loadPlugins<ObjectActionPlugin>('object-plugin').then(plugins => setObjectPlugins(plugins));
}

export function runGameServer(): void {
    gameCache = new GameCache('cache');
    world = new World();
    world.init();
    injectPlugins();

    if(yargs.argv.fakePlayers) {
        world.generateFakePlayers();
    }

    net.createServer(socket => {
        logger.info('Socket opened');
        // socket.setNoDelay(true);
        let clientConnection = new ClientConnection(socket);

        socket.on('data', data => {
            if(clientConnection) {
                clientConnection.parseIncomingData(new RsBuffer(data));
            }
        });

        socket.on('close', () => {
            if(clientConnection) {
                clientConnection.connectionDestroyed();
                clientConnection = null;
            }
        });

        socket.on('error', error => {
            socket.destroy();
            logger.error('Socket destroyed due to connection error.');
        });
    }).listen(GAME_SERVER_PORT, '127.0.0.1');

    logger.info(`Game server listening on port ${GAME_SERVER_PORT}.`);

    const watcher = watch('dist/plugins/');
    watcher.on('ready', function() {
        watcher.on('all', function() {
            Object.keys(require.cache).forEach(function(id) {
                if (/[\/\\]plugins[\/\\]/.test(id)) delete require.cache[id];
            });
        })
    });
}
