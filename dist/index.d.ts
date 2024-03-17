import { HttpResponse, HttpRequest } from 'uWebSockets.js';
export declare const serveDir: (dir: string, notFoundFile?: string) => (res: HttpResponse, req: HttpRequest) => void;
