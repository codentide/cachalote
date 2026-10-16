type QueuedOperation = {
  kind: string
  run: () => Promise<void>
  settle: (ran: boolean, error?: unknown) => void
}

/** One slot's async queue: operations run strictly one at a time, in order. */
export class LiveSlotQueue {
  private pending: QueuedOperation[] = []
  private draining = false

  /** Resolves true once the operation ran, false if a later superseding one dropped it. */
  enqueue(
    kind: string,
    run: () => Promise<void>,
    options: { supersede?: boolean } = {}
  ): Promise<boolean> {
    if (options.supersede) {
      this.dropPending()
    }
    return new Promise<boolean>((resolve, reject) => {
      this.pending.push({
        kind,
        run,
        settle: (ran, error) => (error === undefined ? resolve(ran) : reject(error))
      })
      this.drain()
    })
  }

  /**
   * Queues `run` unless an operation of this kind is already waiting; the caller keeps its own
   * accumulator and `run` drains it, so many events collapse into one pass. Returns whether it queued.
   */
  enqueueCoalesced(kind: string, run: () => Promise<void>): boolean {
    if (this.pending.some((operation) => operation.kind === kind)) {
      return false
    }
    this.pending.push({
      kind,
      run,
      settle: (_ran, error) => {
        if (error !== undefined) {
          console.warn(`[cachalote-live] ${kind} failed`, error)
        }
      }
    })
    this.drain()
    return true
  }

  /** Drops everything that has not started; the running operation is never interrupted. */
  dropPending(): void {
    const dropped = this.pending
    this.pending = []
    for (const operation of dropped) {
      operation.settle(false)
    }
  }

  get isBusy(): boolean {
    return this.draining || this.pending.length > 0
  }

  private drain(): void {
    if (this.draining) {
      return
    }
    this.draining = true
    void this.runNext()
  }

  private async runNext(): Promise<void> {
    for (;;) {
      const operation = this.pending.shift()
      if (!operation) {
        this.draining = false
        return
      }
      try {
        await operation.run()
        operation.settle(true)
      } catch (error) {
        operation.settle(false, error ?? new Error('operation failed'))
      }
    }
  }
}
