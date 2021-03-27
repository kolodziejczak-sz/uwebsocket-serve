import { createReadStream, statSync, existsSync } from 'fs';
import path from 'path';
import mime from 'mime-types';
import { HttpResponse, HttpRequest } from 'uWebSockets.js';

const allowedMethods = ['get', 'head'];

export const serveDir = (dir: string) => (res: HttpResponse, req: HttpRequest) => {
    try {
        const method = req.getMethod();

        if (!allowedMethods.includes(method)) {
            res.writeStatus('405');
            res.writeHeader('Allow', 'GET, HEAD');
            res.end();
            return;
        }

        const url = req.getUrl().slice(1) || 'index.html';
        const filePath = path.resolve(dir, url);
        const fileStats = getFileStats(filePath);

        if (!fileStats) {
            res.writeStatus('404');
            res.end();
            return;
        }

        const { contentType, lastModified, size } = fileStats;
        const ifModifiedSince = req.getHeader('if-modified-since');

        if (ifModifiedSince === lastModified) {
            res.writeStatus('304');
            res.end();
            return;
        }

        res.writeHeader('Content-Type', contentType);
        res.writeHeader('Last-Modified', lastModified);

        if (method === 'head') {
            res.writeHeader('Content-Length', size.toString());
            res.end();
            return;
        }

        streamFile(res, fileStats);
    } catch (error) {
        res.writeStatus('500');
        res.end(error);
    }
};

const getFileStats = (filePath: string) => {
    if (!existsSync(filePath)) {
        return;
    }
    const fileExtension = path.extname(filePath);
    const contentType = mime.lookup(fileExtension);
    const { mtimeMs, size } = statSync(filePath);
    const lastModified = new Date(mtimeMs).toUTCString();

    return { filePath, lastModified, size, contentType };
};

const toArrayBuffer = (buffer: Buffer) => {
    const { buffer: arrayBuffer, byteOffset, byteLength } = buffer;
    return arrayBuffer.slice(byteOffset, byteOffset + byteLength);
};

const streamFile = (
    res: HttpResponse,
    { filePath, size }: ReturnType<typeof getFileStats>
) => {
    const readStream = createReadStream(filePath);
    const destroyReadStream = () => !readStream.destroyed && readStream.destroy();

    const onError = (error: Error) => {
        destroyReadStream();
        throw error;
    };

    const onDataChunk = (chunk: Buffer) => {
        const arrayBufferChunk = toArrayBuffer(chunk);

        const lastOffset = res.getWriteOffset();
        const [ok, done] = res.tryEnd(arrayBufferChunk, size);

        if (!done && !ok) {
            readStream.pause();

            res.onWritable((offset) => {
                const [ok, done] = res.tryEnd(
                    arrayBufferChunk.slice(offset - lastOffset),
                    size
                );

                if (!done && ok) {
                    readStream.resume();
                }

                return ok;
            });
        }
    };

    res.onAborted(destroyReadStream);
    readStream.on('data', onDataChunk).on('error', onError).on('end', destroyReadStream);
};
