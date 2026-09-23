// A synthetic inspection/evidence transport, never a native application test.
import path from 'node:path';
import { documentationFixture } from './documentation-fixture.mjs';
import { createServer } from '../server.mjs';
const fixture=await documentationFixture();
const {server,origin}=await createServer({roots:[fixture.root],port:0,dataDir:path.join(fixture.root,'data')});
console.log(JSON.stringify({origin,root:fixture.root}));
const stop=async()=>{server.closeAllConnections();server.close();await fixture.cleanup();process.exit(0);};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
