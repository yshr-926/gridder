# Polygon boolean Adapter — third-party notice

This module reaches its geometry through **`polygon-clipping`** by Mike Fogel,
licensed under the **MIT License** (<https://github.com/mfogel/polygon-clipping/blob/main/LICENSE.md>).

## License attribution requirement

The MIT License requires the copyright notice and permission notice to be kept
with substantial portions of the software. Gridder does **not** vendor or copy
`polygon-clipping` source; it consumes the published npm package as a runtime
dependency declared in `packages/editor-core/package.json`. The package ships its
own `LICENSE.md` inside `node_modules/polygon-clipping/`, which satisfies the
attribution requirement for a normal dependency install.

No additional notice is needed in the application bundle today. If Gridder later
produces a distributable build that bundles dependency code, add
`polygon-clipping`'s MIT notice to that build's aggregated third-party license
file at that point.
