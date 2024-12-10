import { parentPort } from 'node:worker_threads'
import { EmptyFileSystem } from 'langium'
import { createZenScriptServices } from '../module'

const services = createZenScriptServices(EmptyFileSystem)
const parser = services.parser.LangiumParser
const hydrator = services.serializer.Hydrator

parentPort!.on('message', (text) => {
  const result = parser.parse(text)
  const dehydrated = hydrator.dehydrate(result)
  parentPort!.postMessage(dehydrated)
})
