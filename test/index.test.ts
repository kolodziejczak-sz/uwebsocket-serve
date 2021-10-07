import { exec, ChildProcess } from 'child_process';
import path from 'path';
import { statSync } from 'fs';
import { get } from 'httpie';
import { suite } from 'uvu';
import * as assert from 'uvu/assert';

const filesPath = path.resolve(__dirname, 'app/public');
const httpServerPort = 3000;
const createReqUrl = (file = '') => `http://localhost:${httpServerPort}/${file}`;

const serveDir = suite('serveDir');

serveDir('should respond with a file', async () => {
    const fileName = 'hello_world.json';
    const fileContent = require(path.resolve(filesPath, fileName));

    const res = await get(createReqUrl(fileName));

    assert.is(res.statusCode, 200);
    assert.is(res.headers['content-type'], 'application/json');
    assert.equal(res.data, fileContent);
});

serveDir('should lookup for an index.html file if a req path is /', async () => {
    const res = await get(createReqUrl());

    assert.is(res.statusCode, 200);
    assert.is(res.headers['content-type'], 'text/html');
});

serveDir(
    'should respond with a 403 when a requested file is outside the dir',
    async () => {
        await get(createReqUrl('../../any.gif')).catch((res) => {
            assert.is(res.statusCode, 403);
        });
    }
);

serveDir('should respond with a 404 when a requested file does not exist', async () => {
    await get(createReqUrl('any.gif')).catch((res) => {
        assert.is(res.statusCode, 404);
    });
});

serveDir('should return a 304 when if-modified-since header is correct', async () => {
    const fileName = 'index.html';
    const filePath = path.resolve(filesPath, fileName);
    const { mtimeMs } = statSync(filePath);
    const lastModified = new Date(mtimeMs).toUTCString();

    const res = await get(createReqUrl(fileName), {
        headers: {
            'If-Modified-Since': lastModified,
        },
    });

    assert.is(res.statusCode, 304);
});

let httpServer: ChildProcess;

const killHttpServer = () => {
    if (httpServer && !httpServer.killed) {
        httpServer.kill();
    }
};

const runHttpServer = () => {
    const scriptPath = path.resolve(__dirname, 'app/app.ts');

    return new Promise<void>((resolve) => {
        httpServer = exec(`node -r esbuild-register ${scriptPath} ${httpServerPort}`);
        httpServer.stdout.on('data', console.log);
        httpServer.stdout.once('data', () => resolve());
    });
};

serveDir.before(async () => await runHttpServer());
serveDir.after(() => killHttpServer());
serveDir.run();
