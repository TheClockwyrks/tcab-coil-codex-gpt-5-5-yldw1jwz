# Coil

Coil is a neon grid serpent for the browser. Guide the snake around the bordered
grid, eat pellets to grow, and keep moving cleanly: the walls and your own body
end the round.

The twist is the combo window. Pellets eaten in quick succession raise the
multiplier up to `x5`; wait too long and the multiplier drops back to `x1`.

## Install

```sh
npm ci
```

## Development

```sh
npm run dev
```

The dev server prints the local URL. Open it in a browser and play from the
canvas.

## Production Build

```sh
npm run build
```

The static site is written to `dist/`. It is self-contained and can be served
from the root of a static host or from a sub-path.

## Controls

- Move: Arrow keys or `W` `A` `S` `D`
- Confirm: `Enter` or `Space`
- Pause: `P` or `Escape`
- Back: `Escape`
- Mute: `M`

Touch devices also get the Simple 2D four-way pad and menu buttons.
