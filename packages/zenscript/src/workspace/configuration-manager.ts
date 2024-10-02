export const StringConstants = Object.freeze({
  Config: {
    intellizen: 'intellizen.json',
  },
  Folder: {
    scripts: 'scripts',
    dzs_scripts: 'dzs_scripts',
  },
})

export interface Config {
  scripts?: string
  dzs_scripts?: string
}

interface ConfigurationManager {
  // TODO: What should be here?
}
