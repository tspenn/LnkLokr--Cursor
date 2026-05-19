/** Extension popup uses the chest facing right; web app uses the default. */
export const TREASURE_CHEST_SRC =
  typeof chrome !== 'undefined' && chrome.runtime?.id
    ? '/icons/treasure_chest_transparent_right.png'
    : '/icons/treasure_chest_transparent.png'
