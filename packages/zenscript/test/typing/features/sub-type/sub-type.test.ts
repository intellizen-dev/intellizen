import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClassType } from '../../../../src/typing/type-description'
import { assertNoErrors, createTestServices, getDocument } from '../../../utils'

const services = await createTestServices(__dirname)

describe(`check inferring indexing expression`, async () => {
  const document_classes_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'classes.dzs'))
  const script_classes_zs = document_classes_zs.parseResult.value
  const class_Shape = script_classes_zs.classes[0]
  const class_Circle = script_classes_zs.classes[1]
  const class_Rectangle = script_classes_zs.classes[2]
  const type_Shape = new ClassType(class_Shape, new Map())
  const type_Circle = new ClassType(class_Circle, new Map())
  const type_Rectangle = new ClassType(class_Rectangle, new Map())

  it('should no errors', () => {
    assertNoErrors(document_classes_zs)
  })

  it('check sub-typing', () => {
    expect(services.typing.TypeFeatures.isSubType(type_Circle, type_Circle)).toBeTruthy()
    expect(services.typing.TypeFeatures.isSubType(type_Circle, type_Shape)).toBeTruthy()
    expect(services.typing.TypeFeatures.isSubType(type_Circle, type_Rectangle)).toBeFalsy()
  })
})
