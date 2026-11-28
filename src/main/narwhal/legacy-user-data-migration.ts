import fs from 'node:fs'
import path from 'node:path'

const LEGACY_FILE_RENAMES: readonly (readonly [oldName: string, newName: string])[] = [
  ['cachalote-ceded-chats.json', 'narwhal-ceded-chats.json']
]

/** Copies user-data files left under their pre-Narwhal names; never overwrites and never throws.
 * The legacy file stays so a --rollback to a pre-Narwhal build keeps its ceded chats. */
export function migrateLegacyUserDataFiles(userDataPath: string): void {
  for (const [oldName, newName] of LEGACY_FILE_RENAMES) {
    try {
      const oldPath = path.join(userDataPath, oldName)
      const newPath = path.join(userDataPath, newName)
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.copyFileSync(oldPath, newPath)
      }
    } catch (error) {
      console.error(`[narwhal] failed to migrate ${oldName}:`, error)
    }
  }
}
