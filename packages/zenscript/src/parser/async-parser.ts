import type { LangiumCoreServices } from 'langium'
import path from 'node:path'
import { WorkerThreadAsyncParser } from 'langium/node'

const workerPath = path.resolve(__dirname, 'parser', 'worker.cjs')

export class AsyncParser extends WorkerThreadAsyncParser {
  constructor(services: LangiumCoreServices) {
    super(services, workerPath)
    this.threadCount = 4
  }
}
