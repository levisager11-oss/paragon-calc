# Paragon artwork

Drop one PNG per Paragon in this folder. They are picked up automatically —
nothing else needs editing.

## Filenames

The filename is the Paragon's id with underscores replaced by hyphens, which is
the same slug the `/paragons/<slug>` pages use:

```
apex-plasma-master.png
glaive-dominus.png
ascended-shadow.png
navarch-of-the-seas.png
nautic-siege-core.png
master-builder.png
magus-perfectus.png
goliath-doomship.png
crucible-of-steel-and-flame.png
mega-massive-munitions-factory.png
ballistic-obliteration-missile-bunker.png
herald-of-everfrost.png
root-of-all-nature.png
```

## Format

- **128×128 PNG**, transparent background.
- Square. The art is drawn with `object-fit: contain`, so a non-square image is
  letterboxed inside its tile rather than cropped.
- 128px covers every size the app renders at: 32px tiles at 2x, and the 64px
  hero on a Paragon page at 2x.

## Missing files are fine

Every consumer falls back to the Paragon's emoji when the file is absent, so a
partial set renders correctly. The static page generator checks at build time
and emits the emoji directly, so those pages never flash a broken image.

## Licensing

Bloons TD 6 artwork is Ninja Kiwi's. Whatever you put here is redistributed from
this site, which serves ads — worth confirming you have the right to use it
before shipping the files.
