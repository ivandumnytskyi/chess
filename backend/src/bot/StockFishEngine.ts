import { Worker } from 'node:worker_threads'

export type BotSettings = {
  elo: number
  moveTimeMs: number
  limitStrength: boolean
}

type Waiter = {
  pattern: RegExp
  resolve: (line: string) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const READY_TIMEOUT_MS = 5_000
const SEARCH_GRACE_MS = 1_500

// Stockfish runs in a worker thread so a long or stuck search can't block the Express event loop.
// The worker forwards UCI commands in and engine output lines out.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const stockfish = require(workerData.modulePath);
const engine = stockfish('lite-single', (line) => parentPort.postMessage({ line }));
parentPort.on('message', ({ command }) => engine.processCommand(command));
`

// Runs one Stockfish worker shared by all bot games. Searches are queued so only one runs at a time.
export class StockfishBotEngine {
  private worker: Worker | null = null
  private waiter: Waiter | null = null
  private queue: Promise<unknown> = Promise.resolve()

  bestMove(fen: string, settings: BotSettings): Promise<string | null> {
    const run = this.queue.then(() => this.search(fen, settings))
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  shutdown(): void {
    const worker = this.worker
    this.worker = null
    if (worker) void worker.terminate()

    const waiter = this.waiter
    this.waiter = null
    if (waiter) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('Stockfish engine was stopped'))
    }
  }

  private async search(fen: string, settings: BotSettings): Promise<string | null> {
    try {
      const worker = await this.ensureReady()
      this.send(worker, `setoption name UCI_LimitStrength value ${settings.limitStrength ? 'true' : 'false'}`)
      this.send(worker, `setoption name UCI_Elo value ${settings.elo}`)

      // Register the waiter before sending the search so a fast reply can't be missed.
      const reply = this.waitFor(/^bestmove /, settings.moveTimeMs + SEARCH_GRACE_MS)
      this.send(worker, `position fen ${fen}`)
      this.send(worker, `go movetime ${settings.moveTimeMs}`)

      const line = await reply
      const move = line.split(' ')[1]
      return move === '(none)' ? null : move
    } catch (error) {
      this.shutdown()
      throw error
    }
  }

  private async ensureReady(): Promise<Worker> {
    if (this.worker) return this.worker

    const worker = this.startWorker()
    this.worker = worker
    try {
      await this.request(worker, 'uci', /^uciok/, READY_TIMEOUT_MS)
      this.send(worker, 'setoption name Threads value 1')
      this.send(worker, 'setoption name Hash value 16')
      await this.request(worker, 'isready', /^readyok/, READY_TIMEOUT_MS)
    } catch (error) {
      this.shutdown()
      throw error
    }
    return worker
  }

  private startWorker(): Worker {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { modulePath: require.resolve('stockfish') },
    })
    // The engine should never keep the process alive on its own.
    worker.unref()
    worker.on('message', ({ line }: { line: string }) => {
      if (this.worker === worker) this.handleLine(line)
    })
    worker.on('error', () => {
      if (this.worker === worker) this.shutdown()
    })
    worker.on('exit', () => {
      if (this.worker === worker) this.shutdown()
    })
    return worker
  }

  private send(worker: Worker, command: string): void {
    worker.postMessage({ command })
  }

  private request(worker: Worker, command: string, pattern: RegExp, timeoutMs: number): Promise<string> {
    const reply = this.waitFor(pattern, timeoutMs)
    this.send(worker, command)
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
        timer,
        resolve: (line) => {
          clearTimeout(timer)
          resolve(line)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
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