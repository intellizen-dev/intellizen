import zod from 'zod'

export const StringConstants = Object.freeze({
  Config: {
    intellizen: 'intellizen.json',
  },
  Folder: {
    scripts: 'scripts',
    dzs_scripts: 'dzs_scripts',
  },
})

export const IntelliZenSchema = zod.object({
  rootDirs: zod.array(zod.string().url()),
  extra: zod.optional(zod.object({
    preprocessors: zod.optional(zod.string().url()),
    brackets: zod.optional(zod.string().url()),
  })),
})

export type IntelliZenConfig = zod.infer<typeof IntelliZenSchema>
