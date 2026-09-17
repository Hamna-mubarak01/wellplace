# Styles — how the swap seam is wired

Three tiers, per SYSTEM.md 9.1. Read that section first; this file only records
decisions the code makes that the doc does not yet describe.

```
tokens/primitives.css   raw values — the ONLY file with a hex code (R-20)
        v
tokens/semantic.css     roles, and the light/dark mapping — the swap seam
tokens/typography.css   the two density ramps (9.4)
tokens/spacing.css      radii and control geometry
        v
theme.css               Tailwind v4 @theme -> bg-surface-raised, text-console-body
        v
components              className="bg-surface-raised"
```

`src/app/globals.css` imports `theme.css`, defines the `dark` variant, and
bridges shadcn's role variables onto Onsen roles.

## Settled

**`--accent` is called `--brand` here.** shadcn/ui independently owns `--accent`
and means the subtle hover/active surface behind a menu item. One custom
property cannot carry two roles on `:root` — the later declaration wins and the
brand silently becomes a hover wash. So the brand family is `--brand` /
`--brand-hover` / `--brand-wash` / `--on-brand`, and shadcn keeps `--accent` for
its own meaning, bridged in `src/app/globals.css`. SYSTEM.md 9.2, doc 2 and
doc 3 all name the roles `--brand*` — the docs and this layer agree.

## One open item

**JetBrains Mono is provisional.** 9.3 specifies Raleway [§2] from the client's
brand package, and it is loaded through `next/font/google` in `app/layout.tsx`
at the only three weights that exist in this build — 400, 500 and 700. The
brand package supplies no monospace face, and Raleway cannot hold a column of
numbers in alignment, so JetBrains Mono carries every time, price and booking
reference. That is **our recommendation, pending client approval**: keep it
behind `--onsen-family-data` so a substitution stays one line.
Record both faces in the licence overview (§17.2).

## Rules this layer exists to keep

- No hex outside `tokens/primitives.css` (R-20).
- No Tailwind arbitrary value for colour, spacing or radius — add a token
  instead (R-21). The spacing scale is every multiple of 4 from 4 to 128, which
  Tailwind's default ramp already reproduces, so off-scale values can only be
  written as arbitrary values and lint catches them.
- Components name a role, never a colour (9.1).
- Never edit a file in `components/ui/` to restyle it — that forks the
  component (R-19). Change a token, or wrap and compose (10.3).
