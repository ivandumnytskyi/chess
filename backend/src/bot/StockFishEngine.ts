import stockfish from 'stockfish'

export type BotSettings = {
  elo: number
  moveTimeMs: number
}

type StockfishProcess = ReturnType<typeof stockfish>

type Waiter = {
  pattern: RegExp
  resolve: (line: string) => void
}

const READY_TIMEOUT_MS = 5_000
const SEARCH_GRACE_MS = 1_500

const createEngine = (onMessage: (line: string) => void): StockfishProcess =>
  stockfish('lite-single', onMessage)

// Runs one Stockfish process shared by all bot games. Searches are queued so only one runs at a time.
export class StockfishBotEngine {
  private engine: StockfishProcess | null = null
  private waiter: Waiter | null = null
  private queue: Promise<unknown> = Promise.resolve()

  bestMove(fen: string, settings: BotSettings): Promise<string | null> {
    const run = this.queue.then(() => this.search(fen, settings))
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  shutdown(): void {
    this.engine?.terminate()
    this.engine = null
    this.waiter = null
  }

  private async search(fen: string, settings: BotSettings): Promise<string | null> {
    try {
      const engine = await this.ensureReady()
      engine.processCommand(`setoption name UCI_LimitStrength value true`)
      engine.processCommand(`setoption name UCI_Elo value ${settings.elo}`)

      // Register the waiter before sending the search so a fast reply can't be missed.
      const reply = this.waitFor(/^bestmove /, settings.moveTimeMs + SEARCH_GRACE_MS)
      engine.processCommand(`position fen ${fen}`)
      engine.processCommand(`go movetime ${settings.moveTimeMs}`)

      const line = await reply
      const move = line.split(' ')[1]
      return move === '(none)' ? null : move
    } catch (error) {
      this.shutdown()
      throw error
    }
  }

  private async ensureReady(): Promise<StockfishProcess> {
    if (this.engine) return this.engine

    const engine = createEngine((line) => this.handleLine(line))
    this.engine = engine
    try {
      await this.request(engine, 'uci', /^uciok/, READY_TIMEOUT_MS)
      engine.processCommand('setoption name Threads value 1')
      engine.processCommand('setoption name Hash value 16')
      await this.request(engine, 'isready', /^readyok/, READY_TIMEOUT_MS)
    } catch (error) {
      this.shutdown()
      throw error
    }
    return engine
  }

  private request(engine: StockfishProcess, command: string, pattern: RegExp, timeoutMs: number): Promise<string> {
    const reply = this.waitFor(pattern, timeoutMs)
    engine.processCommand(command)
    return reply
  }

  private waitFor(pattern: RegExp, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null
        reject(new Error(`Stockfish did not reply to ${pattern} within ${timeoutMs} ms`))
      }, timeoutMs)

      this.waiter = {
        pattern,
        resolve: (line) => {
          clearTimeout(timer)
          resolve(line)
        },
      }
    })
  }

  private handleLine(line: string): void {
    if (!this.waiter || !this.waiter.pattern.test(line)) return

    const { resolve } = this.waiter
    this.waiter = null
    resolve(line)
  }
}

export const botEngine = new StockfishBotEngine()