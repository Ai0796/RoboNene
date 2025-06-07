// client/methods/generateTimeZones.ts
/**
 * @fileoverview Generates Object pair of timezone names with their offsets for use with commands
 * @author Ai0796
 */

import { DateTime, Duration } from 'luxon';

const HOUR = Duration.fromObject({ 'hours': 1 });

/**
 * Generates an embed from the provided params
 * @return {Array<[string, number]>} an Object of UTC-XX to the current time pairs
 */
const generateTimeZones = (): [string, number][] => {
    let now = DateTime.now();
    const timezones: [string, number][] = [];

    now = now.minus(Duration.fromObject({ 'hours': 11 }));

    console.log(now.toLocaleString(DateTime.TIME_24_SIMPLE)); // Changed to pass format to toLocaleString

    for (let i = -11; i < 12; i++) {
        timezones.push([`${now.toLocaleString(DateTime.TIME_24_SIMPLE)} (UTC${(i <= 0 ? '' : '+')}${i})`, i]);
        now = now.plus(HOUR);
    }

    return timezones;
};

export default generateTimeZones;