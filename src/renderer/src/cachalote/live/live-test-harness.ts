import { stopLiveStore } from './live-store'
import { createLiveApiFixture, type LiveApiCall } from './live-api-fixture'

type Fixture = ReturnType<typeof createLiveApiFixture>

/** Installs a fake `window.api.cachaloteLive` on a fresh store; call `removeLiveApi` after. */
export function installLiveApi(initial?: Parameters<typeof createLiveApiFixture>[0]): Fixture {
  stopLiveStore()
  const fixture = createLiveApiFixture(initial)
  Object.defineProperty(window, 'api', {
    value: { cachaloteLive: fixture.api },
    configurable: true
  })
  return fixture
}

export function removeLiveApi(): void {
  stopLiveStore()
  Reflect.deleteProperty(window, 'api')
}

export function callsTo(calls: readonly LiveApiCall[], method: LiveApiCall['method']): unknown[] {
  return calls.filter((call) => call.method === method).map((call) => call.args)
}
