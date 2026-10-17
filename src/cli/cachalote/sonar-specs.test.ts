import { describe, expect, it } from 'vitest'
import { SONAR_COMMAND_SPECS } from './sonar-specs'
import { buildAgentContext } from '../agent-context'
import { HANDLER_COMMAND_KEYS } from '../dispatch'
import { ROOT_HELP_TEXT_PRIMARY } from '../root-help-text-primary'
import { COMMAND_SPECS } from '../specs/index'
import { CLI_COMMAND_NAMES } from '../../main/startup/cli-command-names'

describe('orca sonar command specs', () => {
  it('is registered in the spec table, the dispatcher and the launch redirect', () => {
    for (const spec of SONAR_COMMAND_SPECS) {
      expect(COMMAND_SPECS).toContain(spec)
      expect(HANDLER_COMMAND_KEYS.has(spec.path.join(' '))).toBe(true)
    }
    expect(CLI_COMMAND_NAMES).toContain('sonar')
  })

  it('lists every command in the root help', () => {
    for (const spec of SONAR_COMMAND_SPECS) {
      expect(ROOT_HELP_TEXT_PRIMARY).toContain(`  ${spec.path.join(' ')} `)
    }
  })

  it('declares every flag its usage mentions', () => {
    for (const spec of SONAR_COMMAND_SPECS) {
      const flags = [...spec.usage.matchAll(/--([a-z-]+)/g)].map((m) => m[1])
      for (const flag of flags) {
        expect(spec.allowedFlags).toContain(flag)
      }
    }
  })

  it('tells agents to serve through Sonar instead of a dev server', () => {
    const serve = SONAR_COMMAND_SPECS.find((spec) => spec.path[1] === 'serve')!
    expect(serve.notes?.join(' ')).toContain('instead of starting a dev server')
    expect(serve.examples?.length).toBeGreaterThan(0)
    expect(JSON.stringify(buildAgentContext(COMMAND_SPECS))).toContain('sonar serve')
  })

  it('is not destructive, like the other stop commands', () => {
    expect(SONAR_COMMAND_SPECS.some((spec) => spec.destructive)).toBe(false)
  })
})
