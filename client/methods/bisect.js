/**
 * @fileoverview An implementation of a bisect used to efficiently find
 * an index in a sorted array.
 * @author Ai0796
 */

/**
 * A simple bisect left  
 * @param {Object} arr the array we're looking through
 * @param {Number} value the value we're looking for
 * @param {Number} lo the lowest index to search through
 * @param {Number} hi the highest index to search through
 * @returns {Number} the index of the value
 */
function bisectLeft(arr, value, lo = 0, hi = arr.length) {
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < value) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

module.exports = bisectLeft;