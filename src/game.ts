import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BEST_LABEL,
  BINDINGS,
  BITE_SECONDS,
  BOARD_X,
  BOARD_Y,
  CELL,
  CLEARED_TEXT,
  COIL_DEBUG_VERSION,
  COMBO_MAX,
  COMBO_WINDOW,
  CUES,
  CUE_PATHS,
  DIRECTIONS,
  GAMEOVER_TEXT,
  GRID_COLS,
  GRID_ROWS,
  HEAD_FRAMES,
  INTERIOR_MAX_COL,
  INTERIOR_MAX_ROW,
  INTERIOR_MIN_COL,
  INTERIOR_MIN_ROW,
  MODE,
  MODE_LABEL,
  OBSTACLE_CELLS,
  OVER_ITEMS,
  PAUSE_ITEMS,
  PELLET_POINTS,
  SCORE_LABEL,
  SCREENS,
  SPRITE_PATHS,
  STAGE_CX,
  STAGE_H,
  STAGE_W,
  START_CELLS,
  START_DIR,
  TAGLINE_TEXT,
  TICK_SECONDS,
  TITLE_ITEMS,
  TITLE_TEXT,
  TURN_QUEUE_MAX,
} from "./constants";
import type { Cell, Direction, Screen } from "./constants";

export const BACKGROUND = "#061021";

type Rect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};
type MenuPresses = Readonly<Record<string, number | null>>;

interface Sprites {
  readonly head: readonly ImageBitmap[];
  readonly body: ImageBitmap;
  readonly corner: ImageBitmap;
  readonly tail: ImageBitmap;
}

export interface CoilState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly score: number;
  readonly best: number;
  readonly combo: number;
  readonly comboWindow: number;
  readonly muted: boolean;
  readonly ticks: number;
  readonly simTime: number;
  readonly accumulator: number;
  readonly dir: Direction;
  readonly turns: readonly Direction[];
  readonly snake: readonly Cell[];
  readonly pellet: Cell | null;
  readonly obstacles: readonly Cell[];
  readonly steering: boolean;
  readonly travel: boolean;
  readonly pelletRespawn: boolean;
  readonly nextPellet: Cell | null;
  readonly biteTime: number;
  readonly menuPresses: MenuPresses;
  readonly sprites: Sprites;
}

export interface CoilSnapshot {
  readonly version: number;
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly mode: typeof MODE;
  readonly score: number;
  readonly best: number;
  readonly combo: number;
  readonly comboWindow: number;
  readonly muted: boolean;
  readonly ticks: number;
  readonly simTime: number;
  readonly dir: Direction;
  readonly turns: readonly Direction[];
  readonly snake: readonly Cell[];
  readonly pellet: Cell | null;
  readonly obstacles: readonly Cell[];
  readonly steering: boolean;
  readonly travel: boolean;
  readonly pelletRespawn: boolean;
  readonly nextPellet: Cell | null;
}

export interface CoilDebugApi {
  readonly version: typeof COIL_DEBUG_VERSION;
  reset(state: DeepReadonly<CoilState>): CoilState;
  reconcile(state: DeepReadonly<CoilState>): CoilState;
  snapshot(state: DeepReadonly<CoilState>): CoilSnapshot;
  menuItemRect(state: DeepReadonly<CoilState>, index: number): Rect | null;
  setScreen(state: DeepReadonly<CoilState>, screen: Screen): CoilState;
  setMenuIndex(state: DeepReadonly<CoilState>, index: number): CoilState;
  setScore(state: DeepReadonly<CoilState>, points: number): CoilState;
  setBest(state: DeepReadonly<CoilState>, points: number): CoilState;
  setCombo(state: DeepReadonly<CoilState>, multiplier: number): CoilState;
  setComboWindow(state: DeepReadonly<CoilState>, seconds: number): CoilState;
  setSnake(state: DeepReadonly<CoilState>, cells: readonly Cell[]): CoilState;
  setDirection(state: DeepReadonly<CoilState>, dir: Direction): CoilState;
  clearTurns(state: DeepReadonly<CoilState>): CoilState;
  setSnakeSteering(state: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setSnakeTravel(state: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setPellet(
    state: DeepReadonly<CoilState>,
    col: number,
    row: number,
  ): CoilState;
  clearPellet(state: DeepReadonly<CoilState>): CoilState;
  setPelletRespawn(state: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setNextPellet(
    state: DeepReadonly<CoilState>,
    col: number,
    row: number,
  ): CoilState;
  drawPelletCell(state: DeepReadonly<CoilState>): Cell | null;
}

const BOARD_W = GRID_COLS * CELL;
const BOARD_H = GRID_ROWS * CELL;
const MENU_ITEM_W = 300;
const MENU_ITEM_H = 56;
const MENU_ITEM_GAP = 18;

function copyCell(cell: DeepReadonly<Cell>): Cell {
  return { col: cell.col, row: cell.row };
}

function copyCells(cells: readonly DeepReadonly<Cell>[]): Cell[] {
  return cells.map(copyCell);
}

function cellKey(cell: DeepReadonly<Cell>): string {
  return `${cell.col},${cell.row}`;
}

function isDirection(value: string): value is Direction {
  return (DIRECTIONS as readonly string[]).includes(value);
}

function isScreen(value: string): value is Screen {
  return (SCREENS as readonly string[]).includes(value);
}

function deltaFor(dir: Direction): Cell {
  if (dir === "up") return { col: 0, row: -1 };
  if (dir === "down") return { col: 0, row: 1 };
  if (dir === "left") return { col: -1, row: 0 };
  return { col: 1, row: 0 };
}

function isWall(cell: DeepReadonly<Cell>): boolean {
  return (
    cell.col <= 0 ||
    cell.row <= 0 ||
    cell.col >= GRID_COLS - 1 ||
    cell.row >= GRID_ROWS - 1
  );
}

function sameCell(
  a: DeepReadonly<Cell> | null,
  b: DeepReadonly<Cell> | null,
): boolean {
  return a !== null && b !== null && a.col === b.col && a.row === b.row;
}

function perpendicular(a: Direction, b: Direction): boolean {
  return a === "left" || a === "right"
    ? b === "up" || b === "down"
    : b === "left" || b === "right";
}

function validPelletCells(
  state: DeepReadonly<CoilState>,
  currentPellet: Cell | null,
): Cell[] {
  const blocked = new Set(state.snake.map(cellKey));
  for (const obstacle of state.obstacles) blocked.add(cellKey(obstacle));
  if (currentPellet) blocked.add(cellKey(currentPellet));

  const cells: Cell[] = [];
  for (let row = INTERIOR_MIN_ROW; row <= INTERIOR_MAX_ROW; row += 1) {
    for (let col = INTERIOR_MIN_COL; col <= INTERIOR_MAX_COL; col += 1) {
      const cell = { col, row };
      if (!blocked.has(cellKey(cell))) cells.push(cell);
    }
  }
  return cells;
}

function spawnPellet(
  state: DeepReadonly<CoilState>,
  currentPellet: Cell | null,
): { pellet: Cell | null; nextPellet: Cell | null; cleared: boolean } {
  const valid = validPelletCells(state, currentPellet);
  const posed = state.nextPellet ? copyCell(state.nextPellet) : null;
  if (valid.length === 0)
    return { pellet: null, nextPellet: null, cleared: true };
  const selected =
    posed && valid.some((cell) => sameCell(cell, posed))
      ? posed
      : valid[Math.floor(Math.random() * valid.length)];
  return { pellet: copyCell(selected), nextPellet: null, cleared: false };
}

function initialState(sprites: Sprites): CoilState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted: false,
    ticks: 0,
    simTime: 0,
    accumulator: 0,
    dir: START_DIR,
    turns: [],
    snake: copyCells(START_CELLS),
    pellet: null,
    obstacles: copyCells(OBSTACLE_CELLS),
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    biteTime: 0,
    menuPresses: {},
    sprites,
  };
}

function freshRound(
  state: DeepReadonly<CoilState>,
  screen: Screen = "playing",
): CoilState {
  const base: CoilState = {
    ...state,
    screen,
    menuIndex: screen === "playing" ? 0 : state.menuIndex,
    score: 0,
    combo: 1,
    comboWindow: 0,
    ticks: 0,
    simTime: 0,
    accumulator: 0,
    dir: START_DIR,
    turns: [],
    snake: copyCells(START_CELLS),
    pellet: null,
    obstacles: copyCells(OBSTACLE_CELLS),
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: state.nextPellet ? copyCell(state.nextPellet) : null,
    biteTime: 0,
    menuPresses: {},
  };
  return { ...base, ...spawnPellet(base, null), screen };
}

function menuItems(screen: Screen): readonly string[] {
  if (screen === "title") return TITLE_ITEMS;
  if (screen === "paused") return PAUSE_ITEMS;
  if (screen === "gameover" || screen === "cleared") return OVER_ITEMS;
  if (screen === "howto") return ["BACK"];
  return [];
}

function menuRect(screen: Screen, index: number): Rect | null {
  const items = menuItems(screen);
  if (!Number.isInteger(index) || index < 0 || index >= items.length)
    return null;
  const blockH =
    items.length * MENU_ITEM_H + (items.length - 1) * MENU_ITEM_GAP;
  const centerY = screen === "title" ? 438 : screen === "howto" ? 602 : 490;
  return {
    x: STAGE_CX - MENU_ITEM_W / 2,
    y: centerY - blockH / 2 + index * (MENU_ITEM_H + MENU_ITEM_GAP),
    w: MENU_ITEM_W,
    h: MENU_ITEM_H,
  };
}

function rectContains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

function menuIndexAt(
  state: DeepReadonly<CoilState>,
  x: number,
  y: number,
): number | null {
  const items = menuItems(state.screen);
  for (let index = 0; index < items.length; index += 1) {
    const rect = menuRect(state.screen, index);
    if (rect && rectContains(rect, x, y)) return index;
  }
  return null;
}

function enterTitle(state: DeepReadonly<CoilState>): CoilState {
  return {
    ...state,
    screen: "title",
    menuIndex: state.titleIndex,
    accumulator: 0,
    menuPresses: {},
  };
}

function confirmMenu(
  state: DeepReadonly<CoilState>,
  api: UpdateApi | null,
): CoilState {
  if (state.screen === "title") {
    const withTitle = { ...state, titleIndex: state.menuIndex };
    if (state.menuIndex === 0) {
      if (api && !api.audio.looping(CUES.music)) api.audio.loop(CUES.music);
      return freshRound(withTitle, "playing");
    }
    return { ...withTitle, screen: "howto", menuIndex: 0, menuPresses: {} };
  }
  if (state.screen === "howto") return enterTitle(state);
  if (state.screen === "paused") {
    if (state.menuIndex === 0)
      return { ...state, screen: "playing", menuIndex: 0, menuPresses: {} };
    if (state.menuIndex === 1) {
      if (api && !api.audio.looping(CUES.music)) api.audio.loop(CUES.music);
      return freshRound(state, "playing");
    }
    if (api) api.audio.stop(CUES.music);
    return enterTitle(state);
  }
  if (state.screen === "gameover" || state.screen === "cleared") {
    if (state.menuIndex === 0) {
      if (api && !api.audio.looping(CUES.music)) api.audio.loop(CUES.music);
      return freshRound(state, "playing");
    }
    return enterTitle(state);
  }
  return state as CoilState;
}

function materialize(state: DeepReadonly<CoilState>): CoilState {
  return {
    ...state,
    snake: copyCells(state.snake),
    turns: [...state.turns],
    obstacles: copyCells(state.obstacles),
    pellet: state.pellet ? copyCell(state.pellet) : null,
    nextPellet: state.nextPellet ? copyCell(state.nextPellet) : null,
    menuPresses: { ...state.menuPresses },
  };
}

function applyKeyboardInput(
  state: DeepReadonly<CoilState>,
  api: UpdateApi,
): CoilState {
  let next = materialize(state);
  if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());

  const items = menuItems(next.screen);
  if (items.length > 0) {
    if (api.input.pressed("up"))
      next = {
        ...next,
        menuIndex: (next.menuIndex + items.length - 1) % items.length,
      };
    if (api.input.pressed("down"))
      next = { ...next, menuIndex: (next.menuIndex + 1) % items.length };
    if (api.input.pressed("confirm")) next = confirmMenu(next, api);
    if (api.input.pressed("back")) {
      if (
        next.screen === "howto" ||
        next.screen === "gameover" ||
        next.screen === "cleared"
      )
        next = enterTitle(next);
      else if (next.screen === "paused")
        next = { ...next, screen: "playing", menuIndex: 0, menuPresses: {} };
    }
    if (api.input.pressed("pause") && next.screen === "paused") {
      next = { ...next, screen: "playing", menuIndex: 0, menuPresses: {} };
    }
    return next;
  }

  if (next.screen === "playing") {
    for (const dir of DIRECTIONS) {
      if (
        api.input.pressed(dir) &&
        next.steering &&
        next.turns.length < TURN_QUEUE_MAX
      ) {
        next = { ...next, turns: [...next.turns, dir] };
      }
    }
    if (api.input.pressed("back") || api.input.pressed("pause")) {
      next = {
        ...next,
        screen: "paused",
        menuIndex: 0,
        menuPresses: {},
      };
    }
  }
  return next;
}

function applyPointerInput(
  state: DeepReadonly<CoilState>,
  api: UpdateApi,
): CoilState {
  if (menuItems(state.screen).length === 0) return state as CoilState;
  let next = { ...materialize(state), menuPresses: { ...state.menuPresses } };
  for (const sample of api.input.pointerSamples()) {
    const key = `${sample.device}:${sample.id}`;
    const hit = menuIndexAt(next, sample.x, sample.y);
    if (hit !== null) next = { ...next, menuIndex: hit };
    if (sample.type === "down") {
      next = { ...next, menuPresses: { ...next.menuPresses, [key]: hit } };
    } else if (sample.type === "up") {
      const start = next.menuPresses[key] ?? null;
      const presses = { ...next.menuPresses };
      delete presses[key];
      next = { ...next, menuPresses: presses };
      if (start !== null && hit !== null && start === hit) {
        next = confirmMenu({ ...next, menuIndex: hit }, api);
      }
    }
  }
  return next;
}

function resolveTick(
  state: DeepReadonly<CoilState>,
  api: UpdateApi,
): CoilState {
  let dir = state.dir;
  let turns = [...state.turns];
  if (state.steering && turns.length > 0) {
    const [requested, ...rest] = turns;
    turns = rest;
    if (perpendicular(dir, requested)) dir = requested;
  }

  let ticked: CoilState = {
    ...materialize(state),
    dir,
    turns,
    ticks: state.ticks + 1,
  };

  if (state.travel) {
    const head = state.snake[0];
    const delta = deltaFor(dir);
    const newHead = { col: head.col + delta.col, row: head.row + delta.row };
    const eats = sameCell(newHead, state.pellet);
    const solidBody = eats ? state.snake : state.snake.slice(0, -1);
    const fatal =
      isWall(newHead) ||
      state.obstacles.some((cell) => sameCell(cell, newHead)) ||
      solidBody.some((cell) => sameCell(cell, newHead));

    if (fatal) {
      api.audio.play(CUES.death);
      api.audio.stop(CUES.music);
      return {
        ...ticked,
        screen: "gameover",
        menuIndex: 0,
        accumulator: 0,
        biteTime: 0,
      };
    }

    const snake = eats
      ? [newHead, ...copyCells(state.snake)]
      : [newHead, ...copyCells(state.snake).slice(0, -1)];
    ticked = { ...ticked, snake };

    if (eats) {
      const open = state.comboWindow > 0;
      const combo = open ? Math.min(COMBO_MAX, state.combo + 1) : 1;
      const score = state.score + PELLET_POINTS * combo;
      const best = Math.max(state.best, score);
      const afterEat = {
        ...ticked,
        score,
        best,
        combo,
        comboWindow: COMBO_WINDOW,
        biteTime: BITE_SECONDS,
      };
      api.audio.play(CUES.eat);
      if (combo > state.combo) api.audio.play(CUES.comboUp);
      if (!state.pelletRespawn) {
        ticked = { ...afterEat, pellet: null };
      } else {
        const spawned = spawnPellet(
          afterEat,
          state.pellet ? copyCell(state.pellet) : null,
        );
        ticked = {
          ...afterEat,
          pellet: spawned.pellet,
          nextPellet: spawned.nextPellet,
        };
        if (spawned.cleared) {
          api.audio.stop(CUES.music);
          return { ...ticked, screen: "cleared", menuIndex: 0, accumulator: 0 };
        }
      }
    }
  }

  const drainedWindow = Math.max(0, ticked.comboWindow - TICK_SECONDS);
  return {
    ...ticked,
    comboWindow: drainedWindow,
    combo: drainedWindow === 0 ? 1 : ticked.combo,
  };
}

function advanceSimulation(
  state: DeepReadonly<CoilState>,
  api: UpdateApi,
  dt: number,
): CoilState {
  if (state.screen !== "playing")
    return { ...materialize(state), muted: api.audio.muted() };
  let next: CoilState = {
    ...materialize(state),
    simTime: state.simTime + dt,
    accumulator: state.accumulator + dt,
    biteTime: Math.max(0, state.biteTime - dt),
  };
  while (next.accumulator >= TICK_SECONDS && next.screen === "playing") {
    next = resolveTick(
      { ...next, accumulator: next.accumulator - TICK_SECONDS },
      api,
    );
  }
  if (next.screen !== "playing") next = { ...next, accumulator: 0 };
  return {
    ...next,
    best: Math.max(next.best, next.score),
    muted: api.audio.muted(),
  };
}

function assertWhole(
  name: string,
  value: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): void {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`Coil debug: invalid ${name}`);
}

function assertScreen(screen: Screen): void {
  if (!isScreen(screen)) throw new Error("Coil debug: invalid screen");
}

function assertDir(dir: Direction): void {
  if (!isDirection(dir)) throw new Error("Coil debug: invalid direction");
}

function validateSnake(
  cells: readonly Cell[],
  obstacles: readonly DeepReadonly<Cell>[],
): void {
  if (cells.length < 1)
    throw new Error("Coil debug: snake must have at least one cell");
  const seen = new Set<string>();
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    assertWhole("snake col", cell.col, INTERIOR_MIN_COL, INTERIOR_MAX_COL);
    assertWhole("snake row", cell.row, INTERIOR_MIN_ROW, INTERIOR_MAX_ROW);
    if (obstacles.some((obstacle) => sameCell(obstacle, cell)))
      throw new Error("Coil debug: snake overlaps obstacle");
    const key = cellKey(cell);
    if (seen.has(key)) throw new Error("Coil debug: snake repeats a cell");
    seen.add(key);
    const previous = cells[index - 1];
    if (
      previous &&
      Math.abs(previous.col - cell.col) + Math.abs(previous.row - cell.row) !==
        1
    ) {
      throw new Error("Coil debug: snake cells must be adjacent");
    }
  }
}

function makeDebug(): CoilDebugApi {
  return {
    version: COIL_DEBUG_VERSION,
    reset: (state) => ({
      ...initialState(state.sprites as Sprites),
      muted: state.muted,
    }),
    reconcile: (state) => state as CoilState,
    snapshot: (state) => ({
      version: COIL_DEBUG_VERSION,
      screen: state.screen,
      menuIndex: state.menuIndex,
      titleIndex: state.titleIndex,
      mode: MODE,
      score: state.score,
      best: state.best,
      combo: state.combo,
      comboWindow: state.comboWindow,
      muted: state.muted,
      ticks: state.ticks,
      simTime: state.simTime,
      dir: state.dir,
      turns: [...state.turns],
      snake: copyCells(state.snake),
      pellet: state.pellet ? copyCell(state.pellet) : null,
      obstacles: copyCells(state.obstacles),
      steering: state.steering,
      travel: state.travel,
      pelletRespawn: state.pelletRespawn,
      nextPellet: state.nextPellet ? copyCell(state.nextPellet) : null,
    }),
    menuItemRect: (state, index) => menuRect(state.screen, index),
    setScreen: (state, screen) => {
      assertScreen(screen);
      return { ...materialize(state), screen };
    },
    setMenuIndex: (state, index) => {
      const max =
        state.screen === "playing" ? 0 : menuItems(state.screen).length - 1;
      assertWhole("menuIndex", index, 0, max);
      return { ...materialize(state), menuIndex: index };
    },
    setScore: (state, points) => {
      assertWhole("score", points);
      return { ...materialize(state), score: points };
    },
    setBest: (state, points) => {
      assertWhole("best", points);
      return { ...materialize(state), best: points };
    },
    setCombo: (state, multiplier) => {
      assertWhole("combo", multiplier, 1, COMBO_MAX);
      return { ...materialize(state), combo: multiplier };
    },
    setComboWindow: (state, seconds) => {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > COMBO_WINDOW)
        throw new Error("Coil debug: invalid combo window");
      return { ...materialize(state), comboWindow: seconds };
    },
    setSnake: (state, cells) => {
      const snake = cells.map(copyCell);
      validateSnake(snake, state.obstacles);
      return { ...materialize(state), snake };
    },
    setDirection: (state, dir) => {
      assertDir(dir);
      return { ...materialize(state), dir };
    },
    clearTurns: (state) => ({ ...materialize(state), turns: [] }),
    setSnakeSteering: (state, enabled) => ({
      ...materialize(state),
      steering: enabled,
    }),
    setSnakeTravel: (state, enabled) => ({
      ...materialize(state),
      travel: enabled,
    }),
    setPellet: (state, col, row) => {
      const pellet = { col, row };
      assertWhole("pellet col", col, INTERIOR_MIN_COL, INTERIOR_MAX_COL);
      assertWhole("pellet row", row, INTERIOR_MIN_ROW, INTERIOR_MAX_ROW);
      if (
        state.snake.some((cell) => sameCell(cell, pellet)) ||
        state.obstacles.some((cell) => sameCell(cell, pellet))
      ) {
        throw new Error("Coil debug: invalid pellet cell");
      }
      return { ...materialize(state), pellet };
    },
    clearPellet: (state) => ({ ...materialize(state), pellet: null }),
    setPelletRespawn: (state, enabled) => ({
      ...materialize(state),
      pelletRespawn: enabled,
    }),
    setNextPellet: (state, col, row) => {
      assertWhole("next pellet col", col, 0, GRID_COLS - 1);
      assertWhole("next pellet row", row, 0, GRID_ROWS - 1);
      return { ...materialize(state), nextPellet: { col, row } };
    },
    drawPelletCell: (state) => {
      const valid = validPelletCells(
        state,
        state.pellet ? copyCell(state.pellet) : null,
      );
      return valid.length === 0
        ? null
        : copyCell(valid[Math.floor(Math.random() * valid.length)]);
    },
  };
}

function registerDiagnostics(api: InitApi<CoilState>): void {
  api.diagnostics.register("screen", (state) => state.screen);
  api.diagnostics.register("score", (state) => state.score);
  api.diagnostics.register("best", (state) => state.best);
  api.diagnostics.register(
    "combo",
    (state) => `x${state.combo} ${state.comboWindow.toFixed(2)}s`,
  );
  api.diagnostics.register("dir", (state) => state.dir);
  api.diagnostics.register("length", (state) => state.snake.length);
  api.diagnostics.register(
    "head",
    (state) => `${state.snake[0]?.col ?? "-"},${state.snake[0]?.row ?? "-"}`,
  );
  api.diagnostics.register("pellet", (state) =>
    state.pellet ? `${state.pellet.col},${state.pellet.row}` : "none",
  );
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = "center",
  color = "#e9fbff",
): void {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawBoard(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#07172e";
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  ctx.fillStyle = "#10294a";
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, CELL);
  ctx.fillRect(BOARD_X, BOARD_Y + BOARD_H - CELL, BOARD_W, CELL);
  ctx.fillRect(BOARD_X, BOARD_Y, CELL, BOARD_H);
  ctx.fillRect(BOARD_X + BOARD_W - CELL, BOARD_Y, CELL, BOARD_H);

  ctx.strokeStyle = "rgba(103, 251, 255, 0.14)";
  ctx.lineWidth = 1;
  for (let col = 1; col < GRID_COLS; col += 1) {
    const x = BOARD_X + col * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, BOARD_Y + CELL);
    ctx.lineTo(x, BOARD_Y + BOARD_H - CELL);
    ctx.stroke();
  }
  for (let row = 1; row < GRID_ROWS; row += 1) {
    const y = BOARD_Y + row * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(BOARD_X + CELL, y);
    ctx.lineTo(BOARD_X + BOARD_W - CELL, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#67fbff";
  ctx.lineWidth = 3;
  ctx.strokeRect(BOARD_X + 1.5, BOARD_Y + 1.5, BOARD_W - 3, BOARD_H - 3);
}

function cellCenter(cell: DeepReadonly<Cell>): { x: number; y: number } {
  return {
    x: BOARD_X + cell.col * CELL + CELL / 2,
    y: BOARD_Y + cell.row * CELL + CELL / 2,
  };
}

function directionBetween(
  from: DeepReadonly<Cell>,
  to: DeepReadonly<Cell>,
): Direction {
  if (to.col > from.col) return "right";
  if (to.col < from.col) return "left";
  if (to.row > from.row) return "down";
  return "up";
}

function rotationFor(dir: Direction): number {
  if (dir === "right") return 0;
  if (dir === "down") return Math.PI / 2;
  if (dir === "left") return Math.PI;
  return -Math.PI / 2;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  cell: DeepReadonly<Cell>,
  dir: Direction,
): void {
  const center = cellCenter(cell);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotationFor(dir));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -CELL / 2, -CELL / 2, CELL, CELL);
  ctx.restore();
}

function cornerDirection(
  prev: DeepReadonly<Cell>,
  cell: DeepReadonly<Cell>,
  next: DeepReadonly<Cell>,
): Direction {
  const dirs = [directionBetween(cell, prev), directionBetween(cell, next)];
  if (dirs.includes("right") && dirs.includes("down")) return "right";
  if (dirs.includes("down") && dirs.includes("left")) return "down";
  if (dirs.includes("left") && dirs.includes("up")) return "left";
  return "up";
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  const sprites = state.sprites as Sprites;
  state.snake.forEach((cell, index) => {
    if (index === 0) {
      const biteFrame =
        state.biteTime > 0
          ? Math.min(
              HEAD_FRAMES - 1,
              1 +
                Math.floor(
                  (1 - state.biteTime / BITE_SECONDS) * (HEAD_FRAMES - 1),
                ),
            )
          : 0;
      drawSprite(ctx, sprites.head[biteFrame], cell, state.dir);
    } else if (index === state.snake.length - 1) {
      drawSprite(
        ctx,
        sprites.tail,
        cell,
        directionBetween(cell, state.snake[index - 1]),
      );
    } else {
      const prev = state.snake[index - 1];
      const next = state.snake[index + 1];
      const straight = prev.col === next.col || prev.row === next.row;
      drawSprite(
        ctx,
        straight ? sprites.body : sprites.corner,
        cell,
        straight
          ? directionBetween(cell, prev)
          : cornerDirection(prev, cell, next),
      );
    }
  });
}

function drawPellet(
  ctx: CanvasRenderingContext2D,
  pellet: DeepReadonly<Cell> | null,
  frame: number,
): void {
  if (!pellet) return;
  const center = cellCenter(pellet);
  const pulse = 1 + Math.sin(frame * 0.16) * 0.08;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "#ff3fb5";
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff56a";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  drawText(ctx, SCORE_LABEL, 245, 32, 18, "center", "#67fbff");
  drawText(ctx, String(state.score), 245, 70, 34);
  drawText(ctx, BEST_LABEL, 425, 32, 18, "center", "#67fbff");
  drawText(ctx, String(state.best), 425, 70, 34);
  drawText(ctx, MODE_LABEL, 840, 62, 28, "center", "#fff56a");
  drawText(
    ctx,
    state.muted ? "MUTE" : "SOUND",
    1035,
    62,
    20,
    "center",
    state.muted ? "#ff3fb5" : "#67fbff",
  );
  if (state.combo >= 2) {
    drawText(ctx, `x${state.combo}`, 640, 42, 34, "center", "#ff3fb5");
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(550, 76, 180, 10);
    ctx.fillStyle = "#fff56a";
    ctx.fillRect(550, 76, 180 * (state.comboWindow / COMBO_WINDOW), 10);
  }
}

function drawMenu(
  ctx: CanvasRenderingContext2D,
  state: DeepReadonly<CoilState>,
): void {
  const items = menuItems(state.screen);
  items.forEach((item, index) => {
    const rect = menuRect(state.screen, index);
    if (!rect) return;
    const selected = index === state.menuIndex;
    ctx.fillStyle = selected ? "#fff56a" : "rgba(103,251,255,0.12)";
    ctx.strokeStyle = selected ? "#fff56a" : "rgba(103,251,255,0.55)";
    ctx.lineWidth = 2;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    drawText(
      ctx,
      item,
      rect.x + rect.w / 2,
      rect.y + rect.h / 2 + 1,
      24,
      "center",
      selected ? "#061021" : "#e9fbff",
    );
  });
}

function drawOverlayPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "rgba(6,16,33,0.86)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(103,251,255,0.65)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(
    api: InitApi<CoilState>,
  ): Promise<[CoilState, CoilDebugApi]> {
    for (const action of ACTIONS) {
      api.input.register(action, { keys: [...BINDINGS[action]] });
    }
    await Promise.all(
      Object.entries(CUE_PATHS).map(([cue, path]) => api.audio.load(cue, path)),
    );
    const [body, corner, tail, ...head] = await Promise.all([
      api.assets.loadImage(SPRITE_PATHS.body),
      api.assets.loadImage(SPRITE_PATHS.corner),
      api.assets.loadImage(SPRITE_PATHS.tail),
      ...SPRITE_PATHS.head.map((path) => api.assets.loadImage(path)),
    ]);
    const sprites: Sprites = { body, corner, tail, head };
    registerDiagnostics(api);
    return [initialState(sprites), makeDebug()];
  },

  update(
    state: DeepReadonly<CoilState>,
    api: UpdateApi,
    dt: number,
  ): CoilState {
    let next = applyKeyboardInput(state, api);
    next = applyPointerInput(next, api);
    return advanceSimulation(next, api, dt);
  },

  render(state: DeepReadonly<CoilState>, api: RenderApi): void {
    const { ctx } = api;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    drawBoard(ctx);
    drawPellet(ctx, state.pellet, api.frame().count);
    drawSnake(ctx, state);
    drawHud(ctx, state);

    if (state.screen === "title") {
      drawOverlayPanel(ctx, 360, 130, 560, 470);
      drawText(ctx, TITLE_TEXT, STAGE_CX, 225, 86, "center", "#fff56a");
      drawText(ctx, TAGLINE_TEXT, STAGE_CX, 295, 28, "center", "#67fbff");
      drawText(ctx, BEST_LABEL, STAGE_CX, 346, 18, "center", "#ff3fb5");
      drawText(ctx, String(state.best), STAGE_CX, 382, 34);
      drawMenu(ctx, state);
    } else if (state.screen === "howto") {
      drawOverlayPanel(ctx, 250, 105, 780, 560);
      drawText(ctx, "HOW TO PLAY", STAGE_CX, 165, 42, "center", "#fff56a");
      const lines = [
        "The serpent never stops. Turn with Arrow keys or WASD.",
        "A turn takes effect on the next tick, and only at right angles.",
        "Eat pellets to grow. Walls and your own body end the round.",
        "Fast pellets raise the combo. Dawdle and it falls back to x1.",
        "Enter or Space confirms. P pauses. Esc backs out. M mutes.",
      ];
      lines.forEach((line, index) =>
        drawText(ctx, line, STAGE_CX, 235 + index * 52, 24),
      );
      drawMenu(ctx, state);
    } else if (state.screen === "paused") {
      drawOverlayPanel(ctx, 400, 225, 480, 350);
      drawText(ctx, "PAUSED", STAGE_CX, 295, 48, "center", "#fff56a");
      drawMenu(ctx, state);
    } else if (state.screen === "gameover" || state.screen === "cleared") {
      drawOverlayPanel(ctx, 380, 185, 520, 410);
      drawText(
        ctx,
        state.screen === "gameover" ? GAMEOVER_TEXT : CLEARED_TEXT,
        STAGE_CX,
        255,
        46,
        "center",
        "#fff56a",
      );
      drawText(ctx, SCORE_LABEL, 530, 335, 18, "center", "#67fbff");
      drawText(ctx, String(state.score), 530, 375, 34);
      drawText(ctx, BEST_LABEL, 750, 335, 18, "center", "#67fbff");
      drawText(ctx, String(state.best), 750, 375, 34);
      drawMenu(ctx, state);
    }
  },
};
