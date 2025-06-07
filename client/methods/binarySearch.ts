// client/methods/binarySearch.ts
/**
 * @fileoverview An implementation of a binary search used to efficiently search
 * through game data provided in JSON format (since it's pre sorted)
 * @author Potor10
 */

/**
 * A simple binary search
 * @param {number} id the id of the card we're looking for
 * @param {string} property the property of the Object we're looking at
 * @param {any[]} data a large collection of game data that we are trying to search through
 * @return {any | undefined} the card information that matches the id, or undefined if not found
 */
const binarySearch = <T>(id: number, property: keyof T, data: T[]): T | undefined => {
  let start = 0;
  let end = data.length - 1;

  while (start <= end) {
    let mid = Math.floor((start + end) / 2);

    if (data[mid][property] === id) {
      return data[mid];
    } else if (data[mid][property] < id) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }
  return undefined;
};

export default binarySearch;