# StoryLife Builder - Codex Handoff

Last updated: 2026-07-13

## How to continue

At the start of a new Codex chat, read this file, `AGENTS.md`, the current source, and the current git diff before editing. Do not revert existing changes unless the user explicitly asks.

Workspace:

`C:\Users\bulya\Desktop\LifeConstructor\StoryLifeBuilder`

The user speaks Russian and prefers friendly informal communication.

## Product direction

StoryLife Builder is a node-based editor for interactive text games. The current priority is a comfortable visual editor, portable projects with embedded media, reliable offline iPad use, game export, and AI image generation.

The AI story/project generator was intentionally removed from the visible product after repeated failures. Keep Image Studio. Do not re-enable the story generator unless explicitly requested.

## Main commands

```powershell
npm run dev
npm test
npm run build
npm run build:ipad
npm run verify:ipad
```

`npm run dev` uses `scripts/dev.cjs`. It searches for a free port starting at 5173 and passes the chosen URL to Electron through `STORYLIFE_DEV_URL`.

## Important architecture

- React application: `src/`
- Electron main process: `electron/main.ts`
- Actual Electron preload source: `electron/preload.cts`
- Browser type declarations: `src/vite-env.d.ts`
- Domain and migration: `src/domain/project.ts`
- Scene Layout editor: `src/components/Inspector.tsx`
- Play renderer: `src/components/ScenePhone.tsx`
- Node canvas: `src/components/Canvas.tsx`
- Image Studio: `src/components/AIAssistantModal.tsx`
- Portable `.storylife` desktop archive: `electron/projectArchive.ts`
- Browser/iPad archive handling: `src/utils/projectFiles.ts`
- Offline iPad output: `docs/`

There are two preload source files, but Electron loads `dist-electron/preload.cjs`, which is compiled from `electron/preload.cts`. Changes to the bridge must always be made in `preload.cts`. Keep `preload.ts` synchronized if it remains in the repository.

## Current implemented behavior

### Video playback and audio priority

- Video scenes appear as paused static thumbnails on the React Flow node canvas; opening a project does not start all node videos.
- Video continues to play in Scene Layout.
- In Play Mode and exported games, a separate scene `soundPath` has priority over embedded video audio: the video is muted whenever scene audio exists, and can use its own audio only when no separate scene sound is assigned.

### Inspector media rendering stability

- The Scene Picture / Video block no longer uses CSS `contain: strict/layout`; those containment layers could remain sized but fail to paint in Electron while scrolling or switching scenes.
- `Scene Picture / Video` is now a real lazy `CollapsibleSection`. It is closed by default, its preview/actions do not exist in the DOM until `Edit` is clicked, and it closes whenever the selected scene changes.
- All inspector collapsible state is reset when a project, autosave, backup, or new project is opened. Choice editors, scene media, sound, and notes therefore start collapsed even if the new project reuses the previous start-scene ID.
- Embedded `data:` media is never rendered inside the editable path textbox; the inspector shows a short `Embedded image/video` label instead.
- Desktop local image/video/audio previews now use the privileged streaming `storylife-media://` protocol instead of reading whole files into base64 and transferring them over IPC. This removes the main scene-switch memory/GC spike and supports streamed video ranges. The old `image:preview` IPC remains only as a compatibility fallback.
- Node images use lazy asynchronous decoding; paused node videos request metadata through the streaming protocol instead of loading base64 copies.
- Desktop `.storylife` loading extracts archived media to a persistent, content-hash-keyed cache under Electron `userData/media-cache` instead of converting every asset to base64. The `.storylife` file remains a single portable archive; saving again reads the cached local files back into that archive. Persistent cache paths also keep autosaves valid after restarting the app.
- The hidden Electron smoke test verifies full local media loading, a 32-byte `Range` request (`206 Partial Content`), initially collapsed inspector menus, and lazy opening of the scene media menu.

### Scene Layout

- Previous/next scene arrows.
- Switching scenes with the previous/next arrows keeps the Scene Layout modal open.
- Independent fonts for scene text and choice text.
- 20 solid color schemes and 20 gradient schemes.
- Apply layout to all scenes.
- Layout type changes positions only and should not replace colors.
- Separate border visibility checkboxes for title, scene text, and choices.
- Empty text displays nothing; no placeholder copy in Play/Layout.
- `Show scene title` checkbox.
- Transparent panels have no persistent outline; editor outline should only appear on hover/selection.
- Text can move independently from its panel with Ctrl + drag:
  - `titleTextOffsetX/Y`
  - `sceneTextOffsetX/Y`
  - `choiceTextOffsetX/Y`
- Choice text and decorative button frame are separate visual layers.
- `Save Picture` is available in Scene Layout when the scene visual is an image.
- Opacity now applies to every color stop in linear/radial/conic gradients, not
  just solid hex colors. The same renderer is used by Scene Layout, Play Mode,
  and exports, and valid two-stop linear gradients survive project migration.

### Scene pictures and videos

- A scene visual can be either an image or a video while keeping the portable
  `imagePath` field for backward compatibility.
- `visualMediaType` is `image` or `video`; old projects infer video from the file
  extension or a `data:video/...` URL.
- `videoLoop` controls looping and defaults to `true` for old projects.
- Supported scene video formats are MP4, WebM, MOV, and M4V.
- Videos render in Inspector, Scene Layout, Play Mode, Media Pool, canvas nodes,
  portable `.storylife` projects, and normal desktop game exports.
- Local preview resolution waits for Electron's data URL before mounting the
  visual element. This prevents the Inspector preview from racing a blocked
  `file://` load and flickering or disappearing.

### Decorative choice buttons

- There are 20 hand-crafted CSS-native choice styles in
  `src/utils/choiceButtonFrames.ts`, with varied palettes, gradients, borders,
  radii, and shadows.
- The old 30 PNG frames and the original JPG sprite were deleted. They caused
  white rectangular edges and clipping, while the native styles scale cleanly
  at any size and do not load image assets.
- Old `ornate_01` through `ornate_30` project values migrate deterministically
  to `crafted_01` through `crafted_20` for backward compatibility.
- Choice opacity affects the complete native style, including every gradient
  stop, border, and shadow.

### Canvas and choices

- Canvas minimum zoom is 0.05.
- The selected node uses a thick bright cyan outline plus an outer glow and a
  raised z-index so it remains obvious in dense graphs.
- The top toolbar has `Arrange Nodes`. It creates a top-down spanning-tree layout
  from the start scene, centers each parent over its own descendant branch, leaves
  enough vertical space for edge labels, and then fits the canvas to the result.
- Transitions back to the start scene are treated as restart-after-loss links and
  ignored by auto-layout, so the start scene always remains at the top.
- Other cycles and multi-parent nodes are handled once through the spanning tree;
  disconnected components are placed below the reachable story tree.
- Deleting a scene must preserve the current React Flow camera and zoom.
- After deletion, select the adjacent scene, not scene 1.
- Canvas centers a scene only when `focusSelectedSignal` changes. Do not add `scenes` or `selectedSceneId` back to that focus effect dependency list.
- Inspector has two creation commands:
  - `Choice only`: creates a choice with no target and no outcome.
  - `Choice + Scene`: creates a new scene and connects the choice immediately.
- Assigning a target later by select or target-picker creates a valid 100% outcome.
- Target-picker button lets the user click any canvas node.

### Project files and iPad

- Portable projects save as `.storylife` ZIP containers with images/audio embedded.
- Scene image variant originals and generated AI animation frames are also embedded.
- Desktop manual save serializes `projectRef.current`, verifies the generated ZIP,
  writes it, compares the persisted SHA-256 with the generated archive, and opens
  the written archive again before reporting `Saved and verified`.
- If project state changes while an asynchronous save is running, the saved
  snapshot is reported but the editor remains `Unsaved`; close-with-save will not
  close on that stale snapshot.
- Loading accepts `.storylife`, `.zip`, `.json`, and `.txt` where appropriate.
- Media must transfer both directions between desktop and iPad.
- `docs/` is the GitHub Pages/iPad build.
- Offline verification is mandatory after relevant changes:
  `npm run build:ipad` then `npm run verify:ipad`.

### Closing the desktop app

- Toolbar menu has `Exit` only in Electron.
- Close button, Alt+F4, and Exit show save/close/cancel UI.
- Confirmed close marks all BrowserWindows approved and calls `app.quit()`.
- `isApplicationQuitting` prevents the close guard from blocking `app.quit()`.
- This bridge depends on `confirmClose` and `onCloseRequested` in `electron/preload.cts`.

### Image Studio

- Story text is displayed only in the left-side `Scene context` block.
- Scene title/text and full scene JSON must never be added to the image generation prompt.
- Image generation inputs are: explicit prompt, selected style, selected size, selected model, and enabled character references.
- Queue has `Stop generation` and `Clear queue`.
- Image requests carry a request ID and use the Electron `ai:cancel` AbortController path.
- Stopped image requests must never apply their late result to a scene.
- `Apply references` enables/disables references without deleting selections.
- Character references in Image Studio are thumbnail-only toggles. The old name
  and notes inputs under every thumbnail are intentionally hidden; selection is
  shown by the card border and a green checkmark. A small overlay `×` still
  removes a reference.
- Up to three available references are automatically selected for a scene the first time it is opened. Manual deselection is preserved during the mounted session.
- `.storylife` references load as `data:image/...`; Electron must decode and submit these to `/v1/images/edits`. Do not silently discard data URLs.
- If selected references cannot be read, fail with an explicit error rather than silently falling back to ordinary image generation.
- Reference prompt currently strongly requires identity, face, costume, body shape, and key colors to be preserved.
- `Save Picture` saves the current generated scene image through a native desktop
  save dialog (or a browser download outside Electron).
- Every generated/imported image is registered as a scene image variant. Image
  Studio shows a thumbnail strip, and selecting a variant restores it without
  deleting the newer alternatives.
- Each image variant owns its own optional animation. `Show Original` merely sets
  the animation to disabled; `Use Animation` restores it, and only explicit
  `Delete Animation` removes the metadata/AI frames.
- New generated images and AI frames are stored as compressed JPEG files targeting
  at most about 600 KB. Image Studio exposes Low/Medium/High generation quality;
  Low is the default, and AI animation frames always use Low.

### Image animation

- Image Studio adds `Animate` and `Animate with AI` beside `Save Picture` for the
  active image variant. Videos cannot use image animation.
- Procedural mode has 15 presets: zoom in/out, four pans, floating, breathing,
  gentle/nervous/impact/drunk movement, comic idle, pulse, and fade pulse. It
  stores intensity, speed, duration, direction, loop, and enabled state.
- AI mode reuses the existing `aiGenerateSceneImage` / `/v1/images/edits` path and
  always sends the active variant as the mandatory reference. It has Idle, Blink,
  Talking, Head Movement, Breathing, Nervous, Angry, Comic Reaction, Hit Reaction,
  and Custom modes.
- AI animation uses 2-12 playback frames (default 4), FPS, loop, ping-pong,
  movement intensity, custom instruction, and an optional original frame. Frames
  can be viewed, reordered, duplicated, deleted, replaced with the original, or
  regenerated independently. A failed request leaves all completed frames intact.
- Only one animation type is stored per image variant. Creating another type
  replaces that variant's active animation, never the original picture or other
  image variants.
- The shared `AnimatedSceneImage` renderer keeps animation transforms on an inner
  layer so Scene Layout crop/position/scale remains intact. It is used by Image
  Studio preview, Scene Layout, Play Mode, and the exported offline React player.
- React Flow node thumbnails intentionally remain static.
- Normal HTML export copies only the active variant and its active AI frames;
  playback never calls the AI API.

## Recent verification

The regular suite currently has 59 passing Vitest tests across 11 source test files. Production builds have been completing successfully. The Vite warning about a JS chunk over 500 kB is informational.

The exported React game player is intentionally a full-viewport responsive page,
not a phone mockup. `ScenePhone` receives `displayMode="export"` only from
`src/player.tsx`; `src/styles/player.css` removes the preview border, radius, and
shadow, uses the real viewport width, clips horizontal media overflow, and keeps
scene panels inside the screen. Builder Play Mode still uses the existing phone
preview. Do not restore the old 390px `export-phone-scale` wrapper or
`overflow: visible`: it caused wide scene images to extend past mobile screens.

Desktop project saving now follows normal Save/Save As semantics. `App.tsx` keeps
the path of the last successfully saved or loaded portable `.storylife` archive.
Save overwrites that exact file without reopening a dialog; Save As always asks
for a new path and makes it the current file. Loading legacy JSON deliberately
does not make it overwriteable as a ZIP, so its first Save asks for a new
`.storylife` path. Ctrl+S is Save and Ctrl+Shift+S is Save As. The Electron save
handler still reopens the generated archive, writes it, compares SHA-256 hashes,
and opens the persisted archive again. Archive tests cover scene images, image
variants and animation frames, scene sound, background music, character
references, and media-library assets.

The node-canvas foliage, mountain film strip, and balloon use public asset URLs
under `/assets/` and are visually present again. Their URL declarations live in
editor-only `src/styles/editor-assets.css`. `build-player.cjs` uses `publicDir:
false`, so editor-only public decorations are neither referenced by nor copied
into exported game folders.

AI-frame generation now uses the original image at most once in an automatically
planned animation. Every other requested slot makes a real image-edit request;
disabling "Include original image as frame" makes every slot generated. The AI
animation editor shows per-frame Queued/Generating/Ready/Failed/Stopped status,
an overall progress bar, the current frame number, and keeps successful frames
when another frame fails or generation is stopped.

AI animation edits use a dedicated locked-canvas reference mode rather than the
normal character-identity reference prompt. The editor reads the original image
dimensions and, for GPT Image 2, requests a valid custom output size with the
exact source ratio when API constraints allow it (for example 1080x1920 ->
720x1280), with a close-ratio fallback for unusual dimensions. The prompt explicitly
forbids crop/zoom/stretch/reframing and forbids inventing a face/head/body outside
the original crop. The animation preview is capped at 300px/32vh, controls scroll
inside that row, frame thumbnails use `object-fit: contain`, and the modal has six
explicit non-overlapping rows for preview, progress, frames, and footer.
The stopped animation editor preview deliberately bypasses `AnimatedSceneImage`
and renders a plain image with `width/height: auto` plus strict max dimensions
inside a padded stage. Animated playback uses the same stage and overrides the
inner frame image to auto sizing, so portrait and landscape sources must be shown
whole with letterboxing instead of being cropped to fill the preview.
When AI frame cards exist, the modal adds `has-ai-frame-workspace`: the preview
row stays fixed and visible at 160-220px, progress has its own row, the frame
strip consumes the remaining row with independent horizontal/vertical scrolling,
and the footer remains visible. A live desktop visual check confirmed full-image
letterboxed rendering for both a 1673x988 landscape PNG and a 1024x1536 portrait
JPG. No paid image generation was used for that visual check.

The hidden Electron smoke test also verifies that a native choice style renders
as a CSS gradient without `url(...)`, and that moving from scene 1 to scene 2 in
Scene Layout leaves the modal open.

The smoke test additionally creates an image variant, opens Image Studio, verifies
all 15 procedural presets, applies animation, toggles original/animation without
data loss, opens the AI-frame editor, checks the 12-frame limit, and verifies Low
generation quality is selected by default.

The current iPad build in `docs/` includes the latest editor changes. Both
`npm run build:ipad` and `npm run verify:ipad` passed; the verification confirmed
airplane-mode startup and all 12 cached build files.

## Latest editor interaction changes

- Right-click node colors now fill the entire React Flow node surface. `Default`
  restores the neutral cream node, while thumbnails remain contained on a neutral
  image stage. The MiniMap uses the same scene colors.
- Normal node dragging remains visible under the cursor. Ctrl+dragging a node
  creates a new scene at the drop position, adds a choice from the original scene,
  keeps the Inspector on the original scene, expands the new choice, and focuses
  its empty text field so typing can begin immediately.
- The old Image Studio sidebar is hidden. The green `AI Image Studio` toolbar
  button opens the large multi-scene modal directly. It supports Previous/Next
  and a numbered scene range slider.
- Project Settings owns the default scene transition. Scene Layout can inherit
  that default or override it per scene. Directional PUSH transitions were removed.
  Supported transitions are fade, crossfade, zoom in/out, six polished AnimXYZ
  presets, and a physical book-page turn. Old saved PUSH values migrate to fade.
- Exported games add bottom scroll room after the scene using the device safe-area
  inset plus a fixed interaction margin. This does not change Scene Layout element
  coordinates or push iPhone choices upward; it only allows a covered bottom choice
  to be scrolled above Android/iOS browser and navigation bars. Horizontal overflow
  remains clipped, and choice buttons use direct touch handling.

## Transition and ornate-theme follow-up

- Closing Scene Layout must not change the React Flow camera. The old close handler
  deliberately remounted Canvas and incremented the focus-selected signal; it now
  does neither. A browser check confirmed the viewport matrix was byte-for-byte
  identical before opening and after closing Scene Layout.
- Canvas renders `node-drag-preview` as a fixed, pointer-independent copy of the
  scene node while React Flow is dragging. It sits at z-index 100000 and includes
  the current thumbnail, title, layout badge, node color, and scene-type outline.
  The original React Flow `.dragging` node is deliberately transparent, so only
  the copy under the cursor is visible and the old position does not look like a
  duplicate. Keep the preview fallback; the library can remove its own node for
  individual drag frames.
- Scene changes use `TransitionedScenePhone`, which keeps outgoing and incoming
  scenes mounted as overlapping layers until the animation ends. Do not return to
  entry-only animation classes on `ScenePhone`; that produced a blank frame between
  scenes. Fade, crossfade, zooms, and the six AnimXYZ presets retain paired
  incoming/outgoing CSS layers. The ready-made presets are horizontal flip,
  vertical flip, soft spiral, gentle swing, depth dissolve, and dream tilt.
  Page turn is different: it uses the bundled MIT-licensed
  `react-pageflip`/StPageFlip engine to bend the live outgoing HTML page from the
  bottom-right corner, render its reverse copy and physical shadows, and reveal the
  already-rendered next scene underneath. Do not restore the old hand-built
  polygon/`clip-path` curl.
- `ProjectTheme.sceneTransitionSpeed` stores the global 0.5x-2x animation speed.
  `SceneStyle.sceneTransitionSpeed` is `0` for project inheritance or a per-scene
  0.5x-2x override. Both values migrate safely for old projects. Scene Layout has
  an explicit Project/default selector and a slider for each scene.
- Entering Play Mode no longer unmounts the editor. Play is a fixed overlay above
  the still-mounted `.app-shell`, with pointer events and rendering disabled behind
  it via visibility/content-visibility. PlayMode now owns its active scene id, so a
  choice does not re-render the full App/editor tree. This preserves the exact React
  Flow camera and substantially reduces PLAY load. A headless Chrome check used
  a non-default viewport matrix and confirmed byte-for-byte equality before and
  after Play: `translate(-5.75px, 43.75px) scale(0.625)`.
- `will-change` is active only during a scene transition. AnimXYZ transitions render
  exactly two scene layers and remove the outgoing one after completion. Page turn
  no longer renders a third static incoming scene under the two book pages.
- Page turn has an anti-flash handoff for image-heavy scenes. The currently visible
  scene DOM is preserved as a keyed underlay while StPageFlip initializes. The book
  waits for the outgoing image `decode()`/video data (capped at 220ms), paints two
  preparation frames, removes the underlay, and only then starts bending the page.
  Do not replace this with an immediate remount; that caused a one-frame blink on
  some large scene images.
- The incoming scene is rendered both as StPageFlip's actual bottom page and as a
  persistent layer underneath the book. Both image animations start together. The
  real bottom page is therefore visible while the old page bends; when the book
  reports `changeState: read`, it disappears and reveals the already-progressed
  persistent scene without restarting its animation. Do not make the book bottom
  page transparent: StPageFlip's temporary outgoing copy then covers the persistent
  layer until the very end, so the old scene appears throughout the turn.
- A contrast browser QA used red `OLD` and blue `NEW` scenes. Mid-turn DOM and a
  screenshot confirmed the clipped visible bottom page contained `NEW BLUE
  ANIMATED`. Book/persistent zoom scales matched within 0.00031 (`1.00919` vs
  `1.00888`), then the persistent scale continued `1.01608, 1.02483, 1.03487`
  after the book was removed, with no reset.
- A slowed page-turn smoke test confirmed StPageFlip created the temporary soft
  reverse page, kept the next scene below it, and removed the transition host after
  completion. The old white triangle and separately animated page fragment no
  longer exist in the source.
- Changing the transition in Project Settings resets every scene override to
  `sceneTransition: "project"`, so the global setting really applies everywhere.
  Scene Layout `Apply to all scenes` still copies an explicit per-scene transition
  when that is what the author requests.
- Scene Layout has an `Ornate` color-scheme tab with 12 gradient themes. Each theme
  stores an `ornamentStyle` id in SceneStyle and uses a separate SVG 9-slice border
  under `src/assets/theme-ornaments/`. Border checkboxes still control whether the
  ornament is visible for title, scene text, and choices. Vite inlines these SVGs
  into both editor and exported-player CSS, so exported games keep them offline.
- Project Settings uses a compact 280x430 preview with short content cells, leaving
  enough visible background to judge the global colors. It also exposes all 12
  ornate themes and applies the selected full style to every scene. Newly created
  scenes inherit the selected/source scene's layout and style.
- Creating a project now opens a required project-name dialog. The trimmed name is
  written into `project.projectName` before the project exists, so autosave, Save,
  Save As, archives, backups, exports, and the toolbar all use the same name.
- In a choice's Effects section, `+ Flag` remains enabled when the project has no
  flags. It opens a small inline popover; submitting a name atomically creates the
  project flag and appends a true flag effect to that choice.
- AI Image Studio now persists its recipe in the project. Every scene stores the
  current prompt, selected character-reference ids, and the Apply References
  toggle. Every `SceneImageVariant` stores the source prompt, selected references,
  reference toggle, style, exact aspect-ratio id, model, and quality. Navigating to
  a scene restores all controls from its active image automatically; selecting a
  different variant restores that variant's recipe. Keep aspect-ratio ids separate
  from API pixel sizes: several ratios share the same supported OpenAI output size.
- Image variants display their saved prompt and compact recipe under each thumbnail.
  Character references use a two-column, 82px-thumbnail grid so larger casts do not
  require excessive vertical scrolling. Removing a character reference also removes
  its id from scene selections and stored variant metadata.
- Image Studio has an `Edit Image` dialog. It sends the active variant as a locked
  source canvas, accepts a focused edit instruction, and saves the result as a new
  variant while keeping the original. The locked-canvas backend instruction now
  permits any explicitly requested edit while preserving everything not requested;
  AI-frame animation still uses the same path safely.
- Canvas Ctrl-drag now has a distinct create preview. The source node is represented
  by a full-size stationary preview at its original screen position while a green
  half-size `New connected scene` preview follows the pointer. Releasing still uses
  the React Flow drop position to create the new scene and connected choice; ordinary
  dragging keeps the single moving-node preview.
- Project style templates now include five book presets: worn antique folio,
  embossed leather ledger, botanical field journal, enchanted story volume, and
  noir pocket novel. Their backgrounds live under `src/assets/book-backgrounds/`
  and are referenced from `app.css`, so Vite bundles them into both the editor and
  exported player without machine-specific paths.
- Choice button frames now run from `crafted_01` through `crafted_35`; the fifteen
  additions include parchment, stitched leather, botanical, manuscript, library,
  fairytale, noir, celestial, deco, sakura, copper, frost, and halftone variants.
  Selecting any crafted choice frame suppresses the project ornament on choice
  buttons only, preventing doubled borders while title and scene-text ornaments stay
  intact. Migration tests cover both a book ornament id and `crafted_35` persistence.
- Image Studio image-variant cards have a dedicated delete control. Removal asks for
  confirmation, removes the variant from the project, and deletes its managed source
  file from disk only when no other item in the current project uses that path.
  Deleting the active variant selects the nearest remaining variant and restores its
  prompt/reference recipe; deleting the last one clears the scene image.
- Desktop Image Studio shows generated-image storage statistics and its exact folder.
  `Open Folder` opens `app.getPath("userData")/ai-generated-images`; `Clean unused`
  permanently deletes only managed files that are not referenced by the current
  project, including character references, variants, and animation frames. The UI
  warns that old plain JSON/autosaves may still point to those files, while portable
  `.storylife` archives keep their own embedded copies.

The standalone frontend command below currently reports older type errors in the legacy AI story code and some Inspector helpers:

```powershell
npx tsc --noEmit -p tsconfig.json
```

Do not claim the full frontend type-check is clean until those pre-existing errors are addressed. `npm run build` separately compiles Electron TypeScript and performs Vite builds.

## User expectations

- Implement requested changes end to end; do not stop at a proposal unless the user asks only to discuss.
- Preserve existing projects and migration compatibility.
- Never remove user changes or reset the worktree.
- Visual editor behavior matters more than abstract validation machinery.
- Avoid hidden automatic behavior that changes colors, positions, camera, targets, prompts, or project content.
- After Electron preload/main changes, remind the user to restart with Ctrl+C and `npm run dev`.
- After iPad changes, rebuild `docs/` and verify offline operation.
