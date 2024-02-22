import { createReadStream, lstatSync, Stats } from 'fs';
import path from 'path';
import mime from 'mrmime';
import { HttpResponse, HttpRequest } from 'uWebSockets.js';

export const serveDir = (dir: string) => (res: HttpResponse, req: HttpRequest) => {
    try {
        const url = req.getUrl().slice(1) || 'index.html';
        const filePath = path.resolve(dir, url);
        const isFileOutsideDir = filePath.indexOf(path.resolve(dir)) !== 0;

        if (isFileOutsideDir) {
            res.writeStatus('403');
            res.end();
            return;
        }

        const fileStats = getFileStats(filePath);

        if (!fileStats) {
            res.writeStatus('404');
            res.end();
            return;
        }

        const { contentType, lastModified } = fileStats;
        const ifModifiedSince = req.getHeader('if-modified-since');

        if (ifModifiedSince === lastModified) {
            res.writeStatus('304');
            res.end();
            return;
        }

        res.writeHeader('Content-Type', contentType);
        res.writeHeader('Last-Modified', lastModified);

        streamFile(res, fileStats);
    } catch (error) {
        res.writeStatus('500');
        res.end(error);
    }
};

const getFileStats = (filePath: string) => {
    const stats: Stats | undefined = lstatSync(filePath, { throwIfNoEntry: false });

    if (!stats || stats.isDirectory()) {
        return;
    }
    const fileExtension = path.extname(filePath);
    const contentType = mime.lookup(fileExtension) || 'application/octet-stream';
    const { mtime, size } = stats;
    const lastModified = mtime.toUTCString();

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

        res.cork(() => {
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
        });
    };

    res.onAborted(destroyReadStream);
    readStream.on('data', onDataChunk).on('error', onError).on('end', destroyReadStream);
};
