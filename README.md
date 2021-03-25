Static file serving for uWebSockets.js http server.

## Example

```javascript
import path from 'path';
import { App } from 'uWebSockets.js';
import { serveDir } from 'uwebsocket-serve';

const publicPath = path.resolve(__dirname, '../public');
const serveStatic = serveDir(publicPath);

App().get('/*', serveStatic);
```

## API

```typescript
const serveDir = (directoryPath: string) => (res: HttpResponse, req: HttpRequest) => void
```

### serveDir(directoryPath: string)

Create a new middleware function to serve files from within a given root directory. The file to serve will be determined by combining `req.getUrl()` with provided directory.
When a file is not found sending a 404 response.

### Cache

This module supports the `Last-Modified` HTTP header

### Source

This library is based on an [example](https://github.com/uNetworking/uWebSockets.js/blob/master/examples/VideoStreamer.js 'uWebSockets.js/examples/VideoStreamer.js') from a uWebSockets.js repository.

### Support

`uwebsocket-serve` is an MIT-licensed open source project. Feel free to fork and contribute.
