// client/methods/bisect.ts
/**
 * @fileoverview An implementation of a bisect used to efficiently find
 * an index in a sorted array.
 * @author Ai0796
 */

/**
 * A simple bisect left
 * @param {Array<number>} arr the array we're looking through
 * @param {number} value the value we're looking for
 * @param {number} lo the lowest index to search through
 * @param {number} hi the highest index to search through
 * @returns {number} the index of the value
 */
function bisectLeft(arr: number[], value: number, lo: number = 0, hi: number = arr.length): number {
    while (lo < hi) {
      const mid = (lo + hi) >> 1; // Integer division
      if (arr[mid] < value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
  
  export default bisectLeft;