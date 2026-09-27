"use client";

import type { BattleEvent, SideId } from "@/shared/contract";
import {
  CRIT_TEXT,
  EFFECTIVENESS_TEXT,
  STAT_LABELS_ES,
  STATUS_COLORS,
  STATUS_LABELS_ES,
  fieldTint,
  hazardParticle,
  moveFxPlan,
  weatherTint,
} from "@/client/battle/fx/catalog";
import { fxUrl, loadRuntimeIndex, teraIconUrl, type RuntimeIndex } from "@/client/sprites/runtime-index";
import "@/client/battle/fx/fx.css";

/**
 * Arena contract owned by the battle screen:
 * `[data-fx-sprite="p1"|"p2"]`, `[data-fx-hud="p1"|"p2"]`, and a full-size
 * `[data-fx-layer]` (pointer-events: none) inside `ctx.arena`.
 * Temporary nodes are appended to the layer and removed when the effect ends.
 * Faint sets `data-fainted="true"` and opacity 0 on the sprite container;
 * switch/drag clears that so the next Pokémon can scale in.
 */
export interface FxContext {
  /** Missing when the arena unmounts mid-queue; the effect resolves immediately. */
  arena: HTMLElement | null;
  reducedMotion: boolean;
  /** 1 or 2. Durations are divided by this. */
  speed: number;
  signal: AbortSignal;
}

const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";
const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

interface FxSession {
  element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K];
  image(url: string, className: string, parent: HTMLElement): HTMLImageElement;
  play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void>;
  cancel(): void;
}

function ms(ctx: FxContext, duration: number): number {
  if (ctx.reducedMotion) return Math.min(120, Math.max(1, duration));
  const speed = ctx.speed >= 1 ? ctx.speed : 1;
  return Math.max(16, Math.round(Math.min(duration, 1200) / speed));
}

function createSession(ctx: FxContext): FxSession {
  const nodes: HTMLElement[] = [];
  const anims: Animation[] = [];
  return {
    element(tag, className, parent) {
      const el = document.createElement(tag);
      el.className = className;
      parent.appendChild(el);
      nodes.push(el);
      return el;
    },
    image(url, className, parent) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.className = className;
      parent.appendChild(img);
      nodes.push(img);
      return img;
    },
    async play(el, keyframes, options) {
      if (ctx.signal.aborted) return;
      const anim = el.animate(keyframes, options);
      anims.push(anim);
      try {
        await anim.finished;
      } catch {
        /* cancelled or aborted */
      }
    },
    cancel() {
      for (const anim of anims) {
        try {
          anim.cancel();
        } catch {
          /* already finished */
        }
      }
      anims.length = 0;
      for (const node of nodes) node.remove();
      nodes.length = 0;
    },
  };
}

function spriteOf(arena: HTMLElement | null, side: SideId | null | undefined): HTMLElement | null {
  if (!arena || !side) return null;
  return arena.querySelector<HTMLElement>(`[data-fx-sprite="${side}"]`);
}

function layerOf(arena: HTMLElement | null): HTMLElement | null {
  if (!arena) return null;
  return arena.querySelector<HTMLElement>("[data-fx-layer]");
}

function hudOf(arena: HTMLElement | null, side: SideId): HTMLElement | null {
  if (!arena) return null;
  return arena.querySelector<HTMLElement>(`[data-fx-hud="${side}"]`);
}

function centerOf(el: HTMLElement, layer: HTMLElement) {
  const box = el.getBoundingClientRect();
  const host = layer.getBoundingClientRect();
  return { x: box.left - host.left + box.width / 2, y: box.top - host.top + box.height * 0.62 };
}

function topOf(el: HTMLElement, layer: HTMLElement) {
  const box = el.getBoundingClientRect();
  const host = layer.getBoundingClientRect();
  return { x: box.left - host.left + box.width / 2, y: box.top - host.top };
}

function existingFx(index: RuntimeIndex, names: readonly string[], fallback: string): string[] {
  const urls = names.map((name) => fxUrl(index, name)).filter((url): url is string => Boolean(url));
  if (urls.length > 0) return urls.slice(0, 4);
  const backup = fxUrl(index, fallback);
  return backup ? [backup] : [];
}

function flashFull(session: FxSession, ctx: FxContext, color: string, duration: number): Promise<void> {
  const layer = layerOf(ctx.arena);
  if (!layer) return Promise.resolve();
  const el = session.element("div", "fx-flash is-full", layer);
  el.style.background = color;
  return session.play(el, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], {
    duration: ms(ctx, duration),
    easing: EASE_OUT,
  });
}

function flashSpot(session: FxSession, ctx: FxContext, sprite: HTMLElement, color: string, duration: number): Promise<void> {
  const layer = layerOf(ctx.arena);
  if (!layer) return Promise.resolve();
  const box = sprite.getBoundingClientRect();
  const host = layer.getBoundingClientRect();
  const el = session.element("div", "fx-flash", layer);
  el.style.left = `${box.left - host.left}px`;
  el.style.top = `${box.top - host.top}px`;
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
  el.style.borderRadius = "42%";
  el.style.background = color;
  return session.play(el, [{ opacity: 0 }, { opacity: 0.85, offset: 0.35 }, { opacity: 0 }], {
    duration: ms(ctx, duration),
    easing: EASE_OUT,
  });
}

async function playSwitch(side: SideId, drag: boolean, ctx: FxContext, session: FxSession, index: RuntimeIndex) {
  const sprite = spriteOf(ctx.arena, side);
  if (sprite) {
    sprite.removeAttribute("data-fainted");
    sprite.style.opacity = "1";
    sprite.style.translate = "";
    if (!ctx.reducedMotion) sprite.style.scale = "0";
  }
  try {
    if (ctx.reducedMotion) {
      await flashFull(session, ctx, "rgba(255,255,255,0.4)", 120);
      return;
    }
    const layer = layerOf(ctx.arena);
    const jobs: Promise<void>[] = [flashFull(session, ctx, "rgba(255,255,255,0.55)", drag ? 220 : 280)];
    const ball = fxUrl(index, "pokeball");
    if (layer && sprite && ball) {
      const point = centerOf(sprite, layer);
      const img = session.image(ball, "fx-particle", layer);
      img.style.left = `${point.x}px`;
      img.style.top = `${point.y}px`;
      img.style.width = "48px";
      img.style.height = "48px";
      jobs.push(
        session.play(img, [
          { opacity: 0, transform: "scale(0.2)" },
          { opacity: 1, transform: "scale(1.15)", offset: 0.35 },
          { opacity: 0, transform: "scale(1.8)" },
        ], { duration: ms(ctx, drag ? 420 : 520), easing: EASE_OUT }),
      );
    }
    if (sprite) {
      jobs.push(
        session.play(sprite, [
          { scale: "0", opacity: 0 },
          { scale: "1", opacity: 1 },
        ], { duration: ms(ctx, drag ? 520 : 600), easing: EASE_SPRING, fill: "forwards" }),
      );
    }
    await Promise.all(jobs);
  } finally {
    if (sprite) {
      sprite.style.scale = "";
      sprite.style.opacity = "1";
      sprite.removeAttribute("data-fainted");
    }
  }
}

async function shake(session: FxSession, sprite: HTMLElement, ctx: FxContext, duration: number) {
  await session.play(sprite, [
    { translate: "0px 0px" },
    { translate: "-8px 1px", offset: 0.2 },
    { translate: "7px -1px", offset: 0.45 },
    { translate: "-4px 0px", offset: 0.7 },
    { translate: "0px 0px" },
  ], { duration: ms(ctx, duration), easing: EASE_OUT });
}

async function lunge(session: FxSession, attacker: HTMLElement, target: HTMLElement | null, layer: HTMLElement, ctx: FxContext, reach: number) {
  const from = centerOf(attacker, layer);
  const to = target ? centerOf(target, layer) : from;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (dx / len) * 34 * reach;
  const oy = (dy / len) * 34 * reach;
  const hold = reach >= 1;
  await session.play(attacker, hold
    ? [
      { translate: "0px 0px" },
      { translate: `${-ox * 0.35}px ${-oy * 0.35}px`, offset: 0.4 },
      { translate: `${ox}px ${oy}px` },
    ]
    : [
      { translate: "0px 0px" },
      { translate: `${-ox * 0.35}px ${-oy * 0.35}px`, offset: 0.28 },
      { translate: `${ox}px ${oy}px`, offset: 0.62 },
      { translate: "0px 0px" },
    ], { duration: ms(ctx, 280), easing: EASE_OUT, fill: hold ? "forwards" : "none" });
  return hold ? { ox, oy } : null;
}

async function lungeHome(session: FxSession, attacker: HTMLElement, offset: { ox: number; oy: number }, ctx: FxContext) {
  if (!ctx.signal.aborted) {
    await session.play(attacker, [
      { translate: `${offset.ox}px ${offset.oy}px` },
      { translate: "0px 0px" },
    ], { duration: ms(ctx, 140), easing: EASE_IN });
  }
  attacker.style.translate = "";
}

async function travel(session: FxSession, url: string, fromEl: HTMLElement, toEl: HTMLElement, layer: HTMLElement, ctx: FxContext, filter?: string) {
  const from = centerOf(fromEl, layer);
  const to = centerOf(toEl, layer);
  const img = session.image(url, "fx-particle", layer);
  img.style.left = `${from.x}px`;
  img.style.top = `${from.y}px`;
  if (filter) img.style.filter = filter;
  await session.play(img, [
    { opacity: 0, transform: "translate(0px, 0px) scale(0.55)" },
    { opacity: 1, offset: 0.12 },
    { opacity: 1, transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(1)`, offset: 0.82 },
    { opacity: 0, transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(1.35)` },
  ], { duration: ms(ctx, 350), easing: EASE_OUT });
}

async function rise(session: FxSession, urls: readonly string[], sprite: HTMLElement, layer: HTMLElement, ctx: FxContext, filter?: string) {
  const point = centerOf(sprite, layer);
  await Promise.all(urls.map((url, index) => {
    const img = session.image(url, "fx-particle", layer);
    img.style.left = `${point.x + (index - (urls.length - 1) / 2) * 16}px`;
    img.style.top = `${point.y}px`;
    if (filter) img.style.filter = filter;
    return session.play(img, [
      { opacity: 0, transform: "translate(0px, 10px) scale(0.55)" },
      { opacity: 1, offset: 0.22 },
      { opacity: 0, transform: "translate(0px, -40px) scale(1.05)" },
    ], { duration: ms(ctx, 480), delay: index * 40, easing: EASE_OUT });
  }));
}

async function burst(session: FxSession, urls: readonly string[], sprite: HTMLElement, layer: HTMLElement, ctx: FxContext, filter?: string) {
  const point = centerOf(sprite, layer);
  await Promise.all(urls.map((url, index) => {
    const img = session.image(url, "fx-particle", layer);
    img.style.left = `${point.x}px`;
    img.style.top = `${point.y}px`;
    if (filter) img.style.filter = filter;
    const angle = (Math.PI * 2 * index) / Math.max(1, urls.length);
    const dx = Math.cos(angle) * 18;
    const dy = Math.sin(angle) * 14;
    return session.play(img, [
      { opacity: 0, transform: "translate(0px, 0px) scale(0.4)" },
      { opacity: 1, offset: 0.25 },
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(1.25)` },
    ], { duration: ms(ctx, 220), delay: index * 30, easing: EASE_OUT });
  }));
}

async function playMove(event: Extract<BattleEvent, { kind: "move" }>, ctx: FxContext, session: FxSession, index: RuntimeIndex) {
  const attacker = spriteOf(ctx.arena, event.pokemon.side);
  const targetSide = event.target?.side ?? event.pokemon.side;
  const target = spriteOf(ctx.arena, targetSide);
  const recipient = target ?? attacker;
  if (ctx.reducedMotion) {
    if (recipient) await flashSpot(session, ctx, recipient, "rgba(255,255,255,0.4)", 120);
    return;
  }
  const layer = layerOf(ctx.arena);
  if (event.missed || event.failed) {
    if (attacker && layer) await lunge(session, attacker, target, layer, ctx, 0.45);
    return;
  }
  const plan = moveFxPlan(event);
  const fallback = plan.mode === "lunge" ? "impact" : "shine";
  const urls = existingFx(index, plan.images, fallback);
  if (plan.mode === "aura") {
    const selfTarget = !event.target || (event.target.side === event.pokemon.side && event.target.name === event.pokemon.name);
    const host = selfTarget ? attacker : recipient;
    const jobs: Promise<void>[] = [];
    if (host) jobs.push(flashSpot(session, ctx, host, "rgba(255,255,255,0.28)", 480));
    if (host && layer && urls.length > 0) jobs.push(rise(session, urls, host, layer, ctx, plan.filter));
    await Promise.all(jobs);
    return;
  }
  const held = plan.mode === "lunge" && attacker && layer ? await lunge(session, attacker, target, layer, ctx, 1) : null;
  try {
    if (plan.mode === "projectile" && attacker && recipient && layer && urls[0]) {
      await travel(session, urls[0], attacker, recipient, layer, ctx, plan.filter);
    }
    if (recipient) {
      const jobs: Promise<void>[] = [flashSpot(session, ctx, recipient, "rgba(255,255,255,0.5)", 120)];
      if (plan.shake) jobs.push(shake(session, recipient, ctx, 200));
      const burstUrls = plan.mode === "projectile" ? urls.slice(1) : urls;
      if (layer && burstUrls.length > 0) jobs.push(burst(session, burstUrls, recipient, layer, ctx, plan.filter));
      await Promise.all(jobs);
    }
  } finally {
    if (held && attacker) await lungeHome(session, attacker, held, ctx);
  }
}

async function popup(session: FxSession, ctx: FxContext, side: SideId, text: string, tone: "crit" | "resisted" | "immune" | "plain") {
  const layer = layerOf(ctx.arena);
  const sprite = spriteOf(ctx.arena, side);
  if (!layer || !sprite) return;
  const point = topOf(sprite, layer);
  const el = session.element("div", tone === "plain" || tone === "crit" ? "fx-popup" : `fx-popup is-${tone}`, layer);
  el.textContent = text;
  const x = Math.min(Math.max(point.x, 72), Math.max(72, layer.clientWidth - 72));
  el.style.left = `${x}px`;
  el.style.top = `${Math.max(4, point.y - 6)}px`;
  const travel = ctx.reducedMotion ? "translate(-50%, 0px)" : "translate(-50%, -22px)";
  await session.play(el, [
    { opacity: 0, transform: "translate(-50%, 8px)" },
    { opacity: 1, transform: "translate(-50%, 0px)", offset: 0.18 },
    { opacity: 1, offset: 0.7 },
    { opacity: 0, transform: travel },
  ], { duration: ms(ctx, 900), easing: EASE_OUT });
}

async function banner(session: FxSession, ctx: FxContext, side: SideId, text: string) {
  const layer = layerOf(ctx.arena);
  const anchor = hudOf(ctx.arena, side) ?? spriteOf(ctx.arena, side);
  if (!layer || !anchor) return;
  const box = anchor.getBoundingClientRect();
  const host = layer.getBoundingClientRect();
  const el = session.element("div", "fx-banner", layer);
  el.textContent = text;
  el.style.left = `${Math.max(4, box.left - host.left)}px`;
  el.style.top = `${box.bottom - host.top + 4}px`;
  await session.play(el, [
    { opacity: 0, transform: "translateY(6px)" },
    { opacity: 1, transform: "translateY(0px)", offset: 0.18 },
    { opacity: 1, offset: 0.72 },
    { opacity: 0 },
  ], { duration: ms(ctx, 700), easing: EASE_OUT });
}

async function playBoost(event: Extract<BattleEvent, { kind: "boost" }>, ctx: FxContext, session: FxSession, index: RuntimeIndex) {
  if (event.amount === 0) return;
  const sprite = spriteOf(ctx.arena, event.pokemon.side);
  const layer = layerOf(ctx.arena);
  if (!sprite || !layer) return;
  const up = event.amount > 0;
  const count = Math.min(3, Math.abs(event.amount));
  const arrows = (up ? "▲" : "▼").repeat(Math.max(1, count));
  const point = topOf(sprite, layer);
  const el = session.element("div", "fx-boost-label", layer);
  el.textContent = `${arrows} ${STAT_LABELS_ES[event.stat]}`;
  el.style.color = up ? "var(--color-accent-2)" : "var(--color-danger)";
  el.style.left = `${point.x}px`;
  el.style.top = `${Math.max(4, point.y)}px`;
  const travel = ctx.reducedMotion ? "translate(-50%, 0px)" : `translate(-50%, ${up ? "-26px" : "20px"})`;
  const jobs: Promise<void>[] = [
    session.play(el, [
      { opacity: 0, transform: "translate(-50%, 4px)" },
      { opacity: 1, offset: 0.2 },
      { opacity: 0, transform: travel },
    ], { duration: ms(ctx, 700), easing: EASE_OUT }),
    flashSpot(session, ctx, sprite, up ? "rgba(79, 209, 255, 0.35)" : "rgba(240, 84, 79, 0.35)", 480),
  ];
  if (!ctx.reducedMotion && event.stat === "atk" && event.amount >= 2) {
    const sword = fxUrl(index, "sword") ?? fxUrl(index, "shine");
    if (sword) jobs.push(rise(session, [sword], sprite, layer, ctx));
  } else if (!ctx.reducedMotion) {
    const shine = fxUrl(index, "shine");
    if (shine) jobs.push(rise(session, [shine], sprite, layer, ctx));
  }
  await Promise.all(jobs);
}

async function playFaint(side: SideId, ctx: FxContext, session: FxSession) {
  const sprite = spriteOf(ctx.arena, side);
  if (!sprite) return;
  try {
    if (ctx.reducedMotion) {
      await session.play(sprite, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards", easing: EASE_OUT });
    } else {
      await session.play(sprite, [
        { translate: "0px 0px", opacity: 1 },
        { translate: "0px 42%", opacity: 0 },
      ], { duration: ms(ctx, 700), easing: EASE_IN, fill: "forwards" });
    }
  } finally {
    sprite.setAttribute("data-fainted", "true");
    sprite.style.opacity = "0";
    sprite.style.translate = "";
  }
}

async function dropHazards(side: SideId, stem: string, ctx: FxContext, session: FxSession, index: RuntimeIndex) {
  if (ctx.reducedMotion) {
    await flashFull(session, ctx, "rgba(238, 242, 255, 0.22)", 120);
    return;
  }
  const layer = layerOf(ctx.arena);
  const url = fxUrl(index, stem) ?? fxUrl(index, "impact");
  if (!layer || !url) return;
  const height = layer.clientHeight || 320;
  const width = layer.clientWidth || 480;
  const floor = side === "p1" ? height * 0.78 : height * 0.3;
  const start = side === "p1" ? height * 0.4 : 0;
  const columns = [0.18, 0.34, 0.5, 0.66, 0.82];
  await Promise.all(columns.map((column, indexColumn) => {
    const img = session.image(url, "fx-particle", layer);
    img.style.left = `${width * column}px`;
    img.style.top = `${start}px`;
    return session.play(img, [
      { opacity: 0, transform: "translateY(0px)" },
      { opacity: 1, offset: 0.15 },
      { opacity: 0.2, transform: `translateY(${floor - start}px)` },
    ], { duration: ms(ctx, 640), delay: indexColumn * 40, easing: EASE_IN });
  }));
}

async function playTera(event: Extract<BattleEvent, { kind: "terastallize" }>, ctx: FxContext, session: FxSession, index: RuntimeIndex) {
  const sprite = spriteOf(ctx.arena, event.pokemon.side);
  const layer = layerOf(ctx.arena);
  const iconUrl = teraIconUrl(index, event.teraType);
  if (ctx.reducedMotion) {
    const jobs: Promise<void>[] = [flashFull(session, ctx, "rgba(255,255,255,0.45)", 120)];
    if (layer && sprite && iconUrl) {
      const point = centerOf(sprite, layer);
      const img = session.image(iconUrl, "fx-particle", layer);
      img.style.left = `${point.x}px`;
      img.style.top = `${point.y}px`;
      jobs.push(session.play(img, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 120, easing: EASE_OUT }));
    }
    await Promise.all(jobs);
    return;
  }
  const jobs: Promise<void>[] = [
    flashFull(session, ctx, "linear-gradient(115deg, rgba(230,40,41,0.45), rgba(250,192,0,0.4), rgba(63,161,41,0.4), rgba(41,128,239,0.45), rgba(239,112,239,0.4))", 1100),
  ];
  if (sprite) {
    jobs.push(session.play(sprite, [
      { filter: "brightness(1) saturate(1)" },
      { filter: "brightness(1.7) saturate(1.5)", offset: 0.45 },
      { filter: "brightness(1) saturate(1)" },
    ], { duration: ms(ctx, 1100), easing: EASE_OUT }));
  }
  if (layer && sprite) {
    const crystals = existingFx(index, ["rainbow", "shine"], "shine");
    if (crystals.length > 0) jobs.push(burst(session, crystals, sprite, layer, ctx));
    if (iconUrl) {
      const point = centerOf(sprite, layer);
      const img = session.image(iconUrl, "fx-particle", layer);
      img.style.left = `${point.x}px`;
      img.style.top = `${point.y - 28}px`;
      img.style.width = "56px";
      img.style.height = "56px";
      jobs.push(session.play(img, [
        { opacity: 0, transform: "scale(0.2)" },
        { opacity: 1, transform: "scale(1)", offset: 0.35 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: "scale(1.15)" },
      ], { duration: ms(ctx, 1100), easing: EASE_SPRING }));
    }
  }
  await Promise.all(jobs);
}

async function dispatch(event: BattleEvent, ctx: FxContext, session: FxSession, index: RuntimeIndex): Promise<void> {
  switch (event.kind) {
    case "switch":
      return playSwitch(event.pokemon.side, event.cause === "drag", ctx, session, index);
    case "move":
      return playMove(event, ctx, session, index);
    case "damage": {
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      if (!sprite) return;
      if (ctx.reducedMotion) return flashSpot(session, ctx, sprite, "rgba(240, 84, 79, 0.55)", 120);
      await Promise.all([
        shake(session, sprite, ctx, 350),
        flashSpot(session, ctx, sprite, "rgba(240, 84, 79, 0.62)", 350),
      ]);
      return;
    }
    case "heal": {
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      if (!sprite) return;
      const layer = layerOf(ctx.arena);
      const jobs = [flashSpot(session, ctx, sprite, "rgba(61, 220, 132, 0.45)", ctx.reducedMotion ? 120 : 480)];
      if (!ctx.reducedMotion && layer) {
        const shine = fxUrl(index, "shine");
        if (shine) jobs.push(rise(session, [shine], sprite, layer, ctx));
      }
      await Promise.all(jobs);
      return;
    }
    case "faint":
      return playFaint(event.pokemon.side, ctx, session);
    case "status": {
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      const layer = layerOf(ctx.arena);
      if (!sprite) return;
      const jobs = [flashSpot(session, ctx, sprite, STATUS_COLORS[event.status], 420)];
      if (layer) {
        const point = centerOf(sprite, layer);
        const label = session.element("div", "fx-status-label", layer);
        label.textContent = STATUS_LABELS_ES[event.status];
        label.style.color = "var(--color-text)";
        label.style.left = `${point.x}px`;
        label.style.top = `${point.y}px`;
        label.style.transform = "translate(-50%, -50%)";
        jobs.push(session.play(label, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], {
          duration: ms(ctx, 700),
          easing: EASE_OUT,
        }));
      }
      await Promise.all(jobs);
      return;
    }
    case "cureStatus": {
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      if (!sprite) return;
      return flashSpot(session, ctx, sprite, "rgba(238, 242, 255, 0.4)", 240);
    }
    case "boost":
      return playBoost(event, ctx, session, index);
    case "clearBoosts": {
      if (!event.pokemon) return flashFull(session, ctx, "rgba(238, 242, 255, 0.2)", 200);
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      if (!sprite) return;
      return flashSpot(session, ctx, sprite, "rgba(238, 242, 255, 0.28)", 200);
    }
    case "crit":
      return popup(session, ctx, event.pokemon.side, CRIT_TEXT, "crit");
    case "effectiveness":
      return popup(session, ctx, event.pokemon.side, EFFECTIVENESS_TEXT[event.value], event.value === "super" ? "plain" : event.value);
    case "weather": {
      if (event.upkeep) return;
      const tint = event.weather ? weatherTint(event.weather) : "rgba(238, 242, 255, 0.16)";
      return flashFull(session, ctx, tint ?? "rgba(238, 242, 255, 0.2)", event.weather ? 800 : 200);
    }
    case "fieldStart":
      return flashFull(session, ctx, fieldTint(event.effect) ?? "rgba(79, 209, 255, 0.22)", 480);
    case "fieldEnd":
      return flashFull(session, ctx, "rgba(10, 14, 26, 0.18)", 160);
    case "sideStart": {
      const particle = hazardParticle(event.effect);
      if (particle) return dropHazards(event.side, particle, ctx, session, index);
      return flashFull(session, ctx, "rgba(255, 200, 61, 0.16)", 240);
    }
    case "sideEnd":
      return flashFull(session, ctx, "rgba(238, 242, 255, 0.12)", 160);
    case "volatileStart":
    case "volatileEnd": {
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      if (!sprite) return;
      return flashSpot(session, ctx, sprite, "rgba(79, 209, 255, 0.28)", 240);
    }
    case "terastallize":
      return playTera(event, ctx, session, index);
    case "ability":
      return banner(session, ctx, event.pokemon.side, `Habilidad: ${event.ability}`);
    case "item":
      return banner(session, ctx, event.pokemon.side, `${event.consumed ? "Se agotó" : "Objeto"}: ${event.item}`);
    case "formeChange": {
      const sprite = spriteOf(ctx.arena, event.pokemon.side);
      if (!sprite) return flashFull(session, ctx, "rgba(255,255,255,0.35)", 280);
      return Promise.all([
        flashSpot(session, ctx, sprite, "rgba(255,255,255,0.55)", 280),
        ctx.reducedMotion
          ? Promise.resolve()
          : session.play(sprite, [
            { scale: "1" },
            { scale: "1.06", offset: 0.45 },
            { scale: "1" },
          ], { duration: ms(ctx, 280), easing: EASE_OUT }),
      ]).then(() => undefined);
    }
    case "turn":
    case "teamPreview":
    case "message":
    case "win":
      return;
    default: {
      const unreachable: never = event;
      void unreachable;
    }
  }
}

export async function playEventEffect(event: BattleEvent, ctx: FxContext): Promise<void> {
  if (ctx.signal.aborted || !ctx.arena) return;
  const index = await loadRuntimeIndex();
  if (ctx.signal.aborted || !ctx.arena) return;
  const arena = ctx.arena;
  const scoped: FxContext = { ...ctx, arena };
  const session = createSession(ctx);
  const onAbort = () => session.cancel();
  ctx.signal.addEventListener("abort", onAbort);
  try {
    await dispatch(event, scoped, session, index);
  } finally {
    ctx.signal.removeEventListener("abort", onAbort);
    session.cancel();
  }
}
