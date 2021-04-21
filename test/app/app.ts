import path from 'path';
import { App } from 'uWebSockets.js';
import { serveDir } from '../../dist/index';

const args = process.argv.slice(2);
const [port] = args;
const publicPath = path.resolve(__dirname, 'public');

const serveFiles = serveDir(publicPath);

App()
    .get('/*', serveFiles)
    .listen(Number(port), (token) => {
        if (token) {
            console.log('Listening to port ' + port);
        } else {
            console.log('Failed to listen to port ' + port);
        }
    });
