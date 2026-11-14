// Load the configuration belonging to this checkout, even when started from its parent.
// Variables provided by a hosting environment retain precedence.
import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
