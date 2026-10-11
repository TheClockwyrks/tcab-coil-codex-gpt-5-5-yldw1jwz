import { describe, expect, it } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { COMBO_WINDOW, TICK_SECONDS } from "./constants";
import { game } from "./game";
import type { CoilDebugApi, CoilState } from "./game";

function image(): ImageBitmap {
  return {} as ImageBitmap;
}

async function initialized(): Promise<[CoilState, CoilDebugApi]> {
  const initApi = {
    input: { register: () => undefined, layout: () => null },
    audio: {
      define: () => undefined,
      load: () => Promise.resolve(),
    },
    assets: {
      loadImage: () => Promise.resolve(image()),
      loadAudio: () => Promise.resolve({} as AudioBuffer),
      load: () => Promise.resolve(new Blob()),
      resolve: (path: string) => `assets/${path}`,
    },
    diagnostics: { register: () => undefined },
    events: { on: () => () => undefined },
    viewport: () => ({
      width: 1280,
      height: 720,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }),
  } satisfies InitApi<CoilState>;
  return game.initialize(initApi) as Promise<[CoilState, CoilDebugApi]>;
}

function updateApi(pressed: readonly string[] = []): UpdateApi {
  const edges = new Set(pressed);
  const played: string[] = [];
  const api = {
    input: {
      value: () => 0,
      pressed: (name: string) => edges.delete(name),
      pointer: () => ({
        x: 0,
        y: 0,
        down: false,
        device: "mouse",
        buttons: [],
      }),
      pointerPressed: () => false,
      pointerReleased: () => false,
      pointerSamples: () => [],
      pointerContacts: () => [],
      wheel: () => ({ x: 0, y: 0 }),
    },
    audio: {
      play: (cue: string) => {
        played.push(cue);
      },
      loop: () => undefined,
      stop: () => undefined,
      looping: () => false,
      setMuted: () => undefined,
      muted: () => false,
    },
    frame: () => ({ count: 0, timeMs: 0, lastDeltaMs: TICK_SECONDS * 1000 }),
    viewport: () => ({
      width: 1280,
      height: 720,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }),
  } satisfies UpdateApi;
  return api;
}

describe("Coil simulation", () => {
  it("starts a round with the specified chain and a live pellet", async () => {
    const [state, debug] = await initialized();
    const playing = debug.setScreen(debug.reset(state), "playing");
    const snap = debug.snapshot(playing);

    expect(snap.screen).toBe("playing");
    expect(snap.snake).toEqual([
      { col: 15, row: 8 },
      { col: 14, row: 8 },
      { col: 13, row: 8 },
    ]);
    expect(snap.dir).toBe("right");
  });

  it("eats, grows, scores, and consumes a posed next pellet", async () => {
    const [state, debug] = await initialized();
    let s = debug.reset(state);
    s = debug.setScreen(s, "playing");
    s = debug.setPellet(s, 16, 8);
    s = debug.setNextPellet(s, 20, 8);

    s = game.update(s, updateApi(), TICK_SECONDS);
    const snap = debug.snapshot(s);

    expect(snap.score).toBe(10);
    expect(snap.best).toBe(10);
    expect(snap.combo).toBe(1);
    expect(snap.comboWindow).toBeCloseTo(COMBO_WINDOW - TICK_SECONDS);
    expect(snap.snake).toHaveLength(4);
    expect(snap.snake[0]).toEqual({ col: 16, row: 8 });
    expect(snap.pellet).toEqual({ col: 20, row: 8 });
    expect(snap.nextPellet).toBeNull();
  });

  it("queues perpendicular turns across ticks and rejects a reversal", async () => {
    const [state, debug] = await initialized();
    let s = debug.reset(state);
    s = debug.setScreen(s, "playing");
    s = game.update(s, updateApi(["down", "left"]), 0);

    s = game.update(s, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(s).dir).toBe("down");
    expect(debug.snapshot(s).snake[0]).toEqual({ col: 15, row: 9 });

    s = game.update(s, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(s).dir).toBe("left");
    expect(debug.snapshot(s).snake[0]).toEqual({ col: 14, row: 9 });

    s = game.update(s, updateApi(["right"]), TICK_SECONDS);
    expect(debug.snapshot(s).dir).toBe("left");
  });

  it("lets the combo lapse even when travel is disabled", async () => {
    const [state, debug] = await initialized();
    let s = debug.reset(state);
    s = debug.setScreen(s, "playing");
    s = debug.setSnakeTravel(s, false);
    s = debug.setCombo(s, 4);
    s = debug.setComboWindow(s, TICK_SECONDS);

    s = game.update(s, updateApi(), TICK_SECONDS);

    expect(debug.snapshot(s).combo).toBe(1);
    expect(debug.snapshot(s).ticks).toBe(1);
    expect(debug.snapshot(s).snake[0]).toEqual({ col: 15, row: 8 });
  });

  it("uses the tail rule for collision and ends on walls", async () => {
    const [state, debug] = await initialized();
    let s = debug.reset(state);
    s = debug.setScreen(s, "playing");
    s = debug.setSnake(s, [
      { col: 5, row: 5 },
      { col: 5, row: 6 },
      { col: 6, row: 6 },
      { col: 6, row: 5 },
    ]);
    s = debug.setDirection(s, "right");
    s = debug.clearPellet(s);

    s = game.update(s, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(s).screen).toBe("playing");
    expect(debug.snapshot(s).snake[0]).toEqual({ col: 6, row: 5 });

    s = debug.setSnake(s, [{ col: 28, row: 5 }]);
    s = debug.setDirection(s, "right");
    s = game.update(s, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(s).screen).toBe("gameover");
  });
});
