import crypto from 'crypto';
import { defaultMaxListeners } from 'events';

function generateOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}

export default generateOTP;