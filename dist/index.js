"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveDir = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const mime_types_1 = __importDefault(require("mime-types"));
const serveDir = (dir) => (res, req) => {
    try {
        const url = req.getUrl().slice(1) || 'index.html';
        const filePath = path_1.default.resolve(dir, url);
        const isFileOutsideDir = filePath.indexOf(path_1.default.resolve(dir)) !== 0;
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
    }
    catch (error) {
        res.writeStatus('500');
        res.end(error);
    }
};
exports.serveDir = serveDir;
const getFileStats = (filePath) => {
    if (!fs_1.existsSync(filePath)) {
        return;
    }
    if (fs_1.lstatSync(filePath).isDirectory()) {
        return;
    }
    const fileExtension = path_1.default.extname(filePath);
    const contentType = mime_types_1.default.lookup(fileExtension);
    const { mtimeMs, size } = fs_1.statSync(filePath);
    const lastModified = new Date(mtimeMs).toUTCString();
    return { filePath, lastModified, size, contentType };
};
const toArrayBuffer = (buffer) => {
    const { buffer: arrayBuffer, byteOffset, byteLength } = buffer;
    return arrayBuffer.slice(byteOffset, byteOffset + byteLength);
};
const streamFile = (res, { filePath, size }) => {
    const readStream = fs_1.createReadStream(filePath);
    const destroyReadStream = () => !readStream.destroyed && readStream.destroy();
    const onError = (error) => {
        destroyReadStream();
        throw error;
    };
    const onDataChunk = (chunk) => {
        const arrayBufferChunk = toArrayBuffer(chunk);
        const lastOffset = res.getWriteOffset();
        const [ok, done] = res.tryEnd(arrayBufferChunk, size);
        if (!done && !ok) {
            readStream.pause();
            res.onWritable((offset) => {
                const [ok, done] = res.tryEnd(arrayBufferChunk.slice(offset - lastOffset), size);
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
