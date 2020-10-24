/**
 * Removes all entries in the Object which are null.
 */
export function removeNullEntries(obj: object): object {
  for (let key in obj) {
    if (obj[key] === null) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      obj[key] = removeNullEntries(obj[key]);
    }
  }

  return obj;
}
