import "server-only";
import type { SideId } from "../../shared/contract/index.ts";
import { BattleStream, extractChannelMessages } from "../showdown/module.ts";
import type { ShowdownRequest } from "../cpu/contract.ts";
import { InvalidChoiceError } from "./contract.ts";
import { parseShowdownRequest } from "./request-view.ts";

export interface SideError {
  side: SideId;
  message: string;
}

/**
 * One BattleStream plus a background collector.
 * After every write, a setImmediate lets the collector drain the synchronous pushes.
 */
export class BattleSession {
  readonly stream: InstanceType<typeof BattleStream>;
  private readonly rawParts: string[] = [];
  private readonly requests: Record<SideId, string | null> = { p1: null, p2: null };
  private readonly requestEpoch: Record<SideId, number> = { p1: 0, p2: 0 };
  private readonly lockedIn: Record<SideId, boolean> = { p1: false, p2: false };
  private freshErrors: SideError[] = [];
  private collectorError: Error | null = null;
  private cached: { p1: string[]; p2: string[] } | null = null;
  private readonly done: Promise<void>;

  constructor() {
    this.stream = new BattleStream({ keepAlive: true });
    this.done = this.collect();
  }

  get turn(): number {
    return this.stream.battle?.turn ?? 0;
  }

  get ended(): boolean {
    return this.stream.battle?.ended === true;
  }

  get p1Lines(): string[] {
    return this.perspective().p1;
  }

  get p2Lines(): string[] {
    return this.perspective().p2;
  }

  requestRaw(side: SideId): string | null {
    return this.requests[side];
  }

  parsedRequest(side: SideId): ShowdownRequest | null {
    const raw = this.requests[side];
    if (!raw) return null;
    return parseShowdownRequest(raw);
  }

  epoch(side: SideId): number {
    return this.requestEpoch[side];
  }

  lock(side: SideId): void {
    this.lockedIn[side] = true;
  }

  /**
   * A side must act when its latest request is not `wait` and it has not already
   * locked a choice that Showdown accepted without sending a replacement request.
   */
  isActionable(side: SideId): boolean {
    if (this.ended || this.lockedIn[side]) return false;
    const request = this.parsedRequest(side);
    if (!request || request.wait) return false;
    if (request.teamPreview) return true;
    if (request.forceSwitch?.some(Boolean)) return true;
    return Boolean(request.active);
  }

  winner(): "p1" | "p2" | "tie" | null {
    if (!this.ended) return null;
    const name = this.stream.battle?.winner;
    if (name === "Player") return "p1";
    if (name === "CPU") return "p2";
    return "tie";
  }

  /** Replay a saved log. Writes are synchronous; one drain collects every chunk. */
  async replay(lines: readonly string[]): Promise<void> {
    this.freshErrors = [];
    for (const line of lines) this.assertSafeLine(line);
    for (const line of lines) void this.stream.write(line);
    await this.flush();
  }

  async writeLine(line: string): Promise<SideError[]> {
    this.assertSafeLine(line);
    this.freshErrors = [];
    await this.stream.write(line);
    await this.flush();
    return this.freshErrors;
  }

  private assertSafeLine(line: string): void {
    if (line.includes("\n") || line.includes("\r") || line.includes("\0")) {
      throw invalidChoice("Elección inválida.");
    }
    const command = line.startsWith(">") ? (line.slice(1).split(" ")[0] ?? "") : "";
    if (command === "eval" || command === "editbattle") throw invalidChoice("Elección inválida.");
  }

  private async flush(): Promise<void> {
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    if (this.collectorError) throw this.collectorError;
  }

  async destroy(): Promise<void> {
    this.stream.destroy();
    await this.done;
  }

  private async collect(): Promise<void> {
    try {
      for await (const chunk of this.stream) {
        if (typeof chunk === "string") this.ingest(chunk);
      }
    } catch (error) {
      this.collectorError = error instanceof Error ? error : new Error("BattleStream error");
    }
  }

  private ingest(chunk: string): void {
    const lines = chunk.split("\n");
    const type = lines[0];
    if (type === "update") {
      this.rawParts.push(lines.slice(1).join("\n"));
      this.cached = null;
      return;
    }
    if (type === "sideupdate") {
      const side = lines[1];
      if (side !== "p1" && side !== "p2") return;
      const body = lines.slice(2).join("\n");
      for (const line of body.split("\n")) {
        if (line.startsWith("|error|")) {
          this.freshErrors.push({ side, message: line.slice("|error|".length) });
        } else if (line.startsWith("|request|")) {
          this.requests[side] = line.slice("|request|".length);
          this.requestEpoch[side] += 1;
          this.lockedIn[side] = false;
        }
      }
    }
  }

  private perspective(): { p1: string[]; p2: string[] } {
    if (this.cached) return this.cached;
    const joined = this.rawParts.join("\n");
    if (!joined.trim()) {
      this.cached = { p1: [], p2: [] };
      return this.cached;
    }
    const channels = extractChannelMessages(joined, [1, 2]);
    const clean = (lines: readonly string[]) => lines.filter((line) => line.length > 0 && !line.startsWith("|t:"));
    this.cached = { p1: clean(channels[1]), p2: clean(channels[2]) };
    return this.cached;
  }
}

function invalidChoice(message: string): InvalidChoiceError {
  const error = new InvalidChoiceError(message);
  error.name = "InvalidChoiceError";
  return error;
}
