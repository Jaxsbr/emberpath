# Pixel Art Top-Down Scene Layout

How game designers lay out scenes in top-down 2D games: perspective rules, element-by-element placement logic, composition principles, and readability techniques.

*Research context: training an AI coder to generate better top-down world layouts.*

→ Related: [first-game-scope](/wiki/concepts/first-game-scope/) · [solo-dev-on-steam](/wiki/topics/solo-dev-on-steam/)

---

## The Perspective Foundation

Most top-down RPGs (Pokémon, Stardew Valley, Zelda) do **not** use a true top-down view. They use a **3/4 oblique projection** — approximately a 45° downward angle that shows both the top and front face of objects simultaneously.

This creates three implicit rules that every element must follow:

1. **Vertical position = depth.** Higher on screen = farther away. The player walks "up" the screen to go north.
2. **Objects show their front face.** Houses have a visible front wall. Trees show a crown from above, but the trunk is shown at the base like a side-view stub.
3. **Shadows fall downward.** If light is from above-left, shadows appear below-right on screen. Consistent shadow direction is non-negotiable — it's the primary depth cue.

The 3/4 projection is a lie that players have collectively agreed to believe. Everything in scene layout is about maintaining that lie consistently.

---

## Ground Plane: The Foundation Layer

Before placing any objects, the ground plane communicates the zone identity and navigation affordance.

### Terrain Hierarchy (water → land → impassable)

Most top-down games use an implicit layering where the "weight" of a terrain type determines what sits above it:

| Layer | Type | Examples |
|---|---|---|
| Lowest | Water | Ocean, rivers, lakes — typically impassable |
| Base | Soft ground | Grass, sand, snow — walkable |
| Mid | Hard ground | Dirt paths, gravel, cobblestone — walkable, worn |
| High | Elevation | Cliffs, mountains — impassable unless bridged |

Transitions between layers need **edge tiles** (blended corners and sides). The base tile repeats seamlessly; edge tiles handle all the connection cases (4 sides × 4 corners = minimum 8 additional tiles per transition pair).

### Visual Texture Rules (from Slynyrd)

- **Even visual balance** within a tile — no area should dominate or the tiling seam becomes visible
- **Clusters that overlap tile edges** break the pattern and hide the grid
- Keep texture colors to a **small palette** — too many colors in a repeating texture creates visual noise
- **Negative space** (open, less-detailed ground) gives the eye somewhere to rest and makes objects stand out
- Occasional **detail variants** (a flower, a pebble, a crack) break monotony without adding a new tile type

---

## Element-by-Element Placement Rules

### Trees

Trees are the most common top-down object and have well-established placement conventions.

**Shape philosophy:**
- **Round/ball canopy** is the standard: visually stable, reads at any scale, tessellates cleanly in forests. Works at 8×8 to 32×32.
- **Asymmetric trees** are accent pieces for sparse placement (a gnarled tree at a clearing's edge). Do not repeat them — they look odd in a row.
- **General rule**: simple assets repeated look deliberate; unique assets repeated look like a copy-paste error.

**Placement patterns:**
- **Dense forest**: staggered rows, overlapping canopies slightly, consistent lighting direction. The trees form a solid mass — the canopy layer sits above the trunk layer on a separate tilemap layer.
- **Light woods**: irregular clusters of 3–7 trees with gaps between groups. Gaps let light "through" and break the monotony.
- **Lone tree**: accent — next to a building, at a path junction, beside a grave. Implies age, history, or significance.
- **Tree line**: used to define zone edges. A row of trees along a map edge creates a natural border that feels organic rather than arbitrary.

**Color variation**: Use palette swaps to create seasonal variants (spring green, summer deep green, autumn orange, winter bare) without redrawing. Slynyrd notes color swaps are an efficient variation technique.

**Shadow**: Trees cast a downward shadow (relative to the 3/4 view). If the crown fits within the sprite frame, bake the shadow into the asset. For larger trees, use a separate shadow tile on the ground layer.

---

### Paths

Paths are the primary **navigation affordance** — they tell the player where to walk without a map.

**Material → context:**
| Material | Context |
|---|---|
| Dirt/mud | Rural, well-worn, village outskirts, farm access |
| Gravel/pebble | Transitional, between dirt and stone |
| Cobblestone | Town centers, market squares, castle approaches |
| Wood planks | Docks, bridges, interior floors |
| Stone slab | City plazas, temples, important buildings |

**Layout rules:**
- Paths **connect buildings to paths** and **paths to other paths** — they are never dead-ends (except a spur to a point of interest)
- **Width signals importance**: a main road is 2–3 tiles wide; a side path is 1 tile; a goat trail is half a tile (broken ground texture)
- Paths **curve gently** — perfectly straight paths feel mechanical. Insert 1–2 tile bends even on "straight" roads
- **Intersections create landmarks**: the junction of two paths is where players orient themselves. Place a sign, a well, or a tree at junctions
- Paths should **darken slightly** toward building entrances (more foot traffic = worn) and **lighten** at open areas (less compressed dirt)

**Edge treatment**: Where a dirt path meets grass, you need transition tiles for all 8 directions (4 sides + 4 corners). This is the most labor-intensive part of path integration.

---

### Houses and Buildings

**Facing convention:**
Almost all buildings in top-down games **face south** (toward the bottom of screen = toward the camera). The entrance is always on the south-facing wall. This is because players approach buildings from below and the door must be visible.

**Placement rules:**
- Buildings are never placed in water or on impassable terrain
- Buildings have a **setback** from the path — at least 1 tile of ground between the path and the building's south face. This creates space for the "front yard" visual and feels less cramped
- Buildings are placed on **flat ground** — the base of a building must be a horizontal line across the screen. A house built into a slope must have a terraced approach
- Group buildings to form **settlements**: 3–5 houses clustered together feels like a hamlet; 8–15+ feels like a town. Isolation = a farmhouse or hermit's hut
- Vary building sizes within a cluster — identical houses feel like a planned development (which can be intentional for military outposts or corporate towns)

**Internal logic:**
Buildings with chimneys have a chimney at the back (north side) or side. Doors align with the path leading to them. Windows face south and east (toward the light source in Western convention).

**Roofs:**
Roofs occupy the **top portion** of the building sprite — in 3/4 projection the roof is shown at a slight angle. The roof color distinguishes building type: red/terracotta = residential, grey = stone/castle, brown = barn, teal = merchant.

---

### Fences

Fences serve three functions: enclosure, direction, and visual rhythm.

**Types:**
| Fence type | Use |
|---|---|
| Wooden picket | Residential, garden, farm |
| Wooden post-and-rail | Livestock, open ranch |
| Stone wall | Castle, ancient ruins, mountainside |
| Iron railing | Urban, wealthy neighborhood |
| Bamboo | Eastern setting, garden |

**Placement rules:**
- Fences **connect to buildings** at corners — a fence that ends in open air looks unfinished
- Fences follow **property logic** — they enclose something (a garden, livestock, a graveyard)
- Fences used as **path borders** create a corridor that guides the player. This is an explicit navigation tool: a road flanked by fences on both sides is a highway with no choice of direction
- Fence **corners and gates** are separate tiles — an 8-direction fence set needs straight segments (horizontal, vertical), corners (4), T-junctions (4), and gates

**Terrain variation**: stone walls on steep terrain (they look like they're embedded in the hill); wooden fences on flat farmland; ruined/broken fence sections indicate abandoned or attacked areas.

---

### Mountains and Cliffs

Mountains serve as the **world boundary** and zone separator. They are almost always impassable terrain.

**Visual construction:**
- Mountains are built from **cliff-face tiles** stacked vertically, not drawn as single objects
- The cliff face shows the rock texture; the mountain top is a separate tile type (snow, rock, vegetation depending on biome)
- **Terracing** creates visual depth: 2–3 stepped cliff levels feel more like a real mountain than a single-height wall
- Drop shadows from cliff edges create depth — the shadow falls on the wall face below, not on the ground

**Placement logic:**
- Mountains form **natural borders** — they curve around playable zones in horseshoe or arc shapes
- Leave **gaps** in mountain ranges for passes, valleys, or cave entrances — a mountain range with no opening feels like a wall (intentional in some designs)
- Mountains cluster: lone mountain peaks exist but are design landmarks; more commonly mountains form ranges
- Mountains on the **north edge** of a zone (top of screen) look most natural in 3/4 projection — mountains on the south edge (bottom of screen) look like a wall behind the player

**Palette**: Mountain rock is typically cooler (grey/blue-grey) than ground terrain (warm tan/green). Snow caps start appearing at a certain height. Dark rock suggests volcanic or hostile territory.

---

### Caves

Cave entrances are **threshold tiles** — visual markers that tell the player "you can enter here and the world changes."

**Design elements:**
- The **cave mouth** is a dark opening — the interior is shown as solid black or very dark grey, suggesting depth
- Cave entrances are **set into a cliff or mountain face** — never appearing on flat ground (a hole in flat ground is a pit, not a cave)
- **Stalactite/overhang pixels** at the top of the cave mouth add visual interest and reinforce the idea that the player is going under rock
- A subtle **shadow gradient** from the entrance inward (light at mouth, dark within) suggests depth without requiring interior tiles
- Cave entrances often have **context clues**: footprints in the dirt leading in, bones, discarded equipment, torchlight from within

**Placement:**
- Caves appear at the **base of mountains** or in cliff faces — never at the top
- Multiple cave openings on the same cliff face suggest a mine or dungeon complex
- A **single isolated cave entrance** in a mountain range is a story beat: the dungeon entrance, the dragon's lair, the hermit's home

---

### Rivers

Rivers are **linear terrain features** that divide zones and create traversal challenges.

**Flow rules:**
- Rivers **flow downhill** — in 3/4 projection this means generally southward (toward the bottom of the screen), though winding rivers can run in any direction
- River width is **not constant** — narrow upstream, wider at delta/ocean. Narrower = faster current (implication); wider = calmer
- Rivers **curve** — a perfectly straight river looks artificial. Rivers meander with 2–4 tile bends per screen length
- Rivers cannot **teleport** or **branch randomly** — once a river starts, it must connect to another body of water (lake, ocean) or another river. No dead-end rivers

**Tile anatomy:**
- **Current tiles**: The water surface shows direction via wave patterns. Horizontal waves = river flows left-right; diagonal waves = flowing obliquely
- **Bank tiles**: The edge where water meets land. Often includes a muddy/sandy strip (the bank) before transitioning to grass
- **Foam/rapids**: White pixels at bends or narrow sections imply fast water
- **Depth variation**: Darker water tiles in the center of wide rivers (deeper) vs lighter near banks (shallow)

**Crossing points:**
Rivers should have 1–3 crossing points per zone: bridges (engineered), fords (shallow water walkable), fallen logs (rustic). The placement of these crossings is level design — they funnel player movement.

---

### Bridges

Bridges are the **crossing affordance** for rivers and gaps.

**Types:**
| Bridge type | Context |
|---|---|
| Wooden plank | Rural, makeshift, temporary |
| Stone arch | Town, permanent, old infrastructure |
| Rope/suspension | Mountain, exotic, danger implied |
| Drawbridge | Castle, controlled access |

**Placement rules:**
- Bridges are placed at **river narrows** — the widest point of a river is where you put a ferry, not a bridge
- Bridges sit **perpendicular to the river** — always a 90° crossing. Diagonal bridges exist but are rare and imply irregular terrain
- The bridge surface must connect seamlessly to the path tiles on both banks
- Bridges have **railings/guard rails** — these extend slightly above the bridge surface tile on the north side (in 3/4 projection this means a railing appears at the top of the bridge tile that partially overlaps the river bank behind it)
- A bridge with **damage** (missing planks, cracked stone) is an environmental story beat and may be impassable

---

### Ocean and Coastlines

**Coastline design:**
- The **beach** is a mandatory transition zone between ocean and land — a strip of sand (1–3 tiles wide) before vegetation starts. Abrupt ocean-to-grass transitions look wrong
- Coastlines are **irregular** — no perfectly straight shoreline. Inlets, peninsulas, and rocky outcrops create visual interest and navigational landmarks
- **Cliffs into ocean**: where land meets water without a beach, use cliff tiles that transition directly to dark water. The cliff face shows darker water at the base (depth cue)

**Water rendering:**
- Ocean is **animated**: 2-frame animation at minimum, cycling wave pattern. Coastal foam tiles animate separately
- **Color depth**: Water gets darker (deeper blue/teal) away from shore. The color gradient implies depth and makes the ocean feel large
- **Whitecaps**: Small white pixel highlights on wave peaks indicate wind/surface movement. Remove them in calm bay areas

**Features:**
- Docks extend perpendicular to the shoreline into water
- Boats are props placed in water tiles or at docks
- Lighthouses on rocky coastline points — tall vertical structure acting as navigation landmark
- Sea caves at cliff bases

---

## Composition Principles

### Clusters vs. Singletons

The ratio of clustered to isolated elements controls zone character:

| Placement style | Feeling |
|---|---|
| Everything clustered | Dense, overgrown, oppressive, ancient |
| Mix of cluster + spacing | Natural, lived-in, varied |
| Everything isolated | Sparse, desolate, recently cleared, dangerous |

Natural environments cluster organically (trees grow where seeds fall, rocks tumble together). Artificial environments create clear spacing (houses in a planned village, crops in rows, fences in straight lines). The contrast between organic and artificial placement is how players distinguish wilderness from civilization.

### Leading Lines

Rivers, paths, fence rows, and tree lines are all **leading lines** that guide the player's eye and movement. Every zone should have at least one dominant leading line that runs roughly top-to-bottom (into the zone) to orient the player on arrival.

Lines converging toward a point create perspective and depth. A path that narrows as it goes "north" implies the zone extends farther than it appears.

### Focal Points

Every scene needs 1–3 **focal points**: the thing the player's eye lands on first. In top-down games these are:
- A large building (the tavern, the castle, the boss lair)
- A distinctive tree (the ancient oak)
- A body of water (the pond, the fountain)
- A height change (a cliff, an elevated platform)

Focal points should be **off-center** — a building dead-center of a zone feels static. Place the focal point at one of the rule-of-thirds intersections.

### Negative Space

Empty ground is not wasted space. Open areas serve as:
- **Rest zones** between areas of visual density
- **Combat arenas** (open space for player movement)
- **Visual contrast** that makes the surrounding density feel denser
- **Future space** (the cleared field that becomes the player's farm)

A common mistake for beginners is filling every tile with objects. Leave 40–60% of ground clear.

### Natural Variation Without Randomness

Pure randomness looks random, not natural. Natural-looking placement follows rules:
- **Trees**: place in groups of 3–7 with irregular spacing; avoid perfect grids; clusters have a dominant size and 1–2 smaller "satellite" trees
- **Rocks**: cluster near cliff bases (rockfall logic); scatter singly on open ground; pair rocks of different sizes
- **Flowers/detail tiles**: scatter in patches of 5–15 tiles, not individual tiles
- **Paths**: meander but maintain roughly consistent direction; don't loop back on themselves without purpose

---

## Readability and Affordance Rules

### Color-Coded Terrain

Successful top-down games use consistent color palettes that players learn to read:
- **Blue/teal** = water (impassable without a bridge)
- **Green** = walkable vegetation
- **Brown/tan** = path (designed for walking)
- **Grey** = stone (impassable cliff, or walkable if paved)
- **Black** = cave/interior entrance, darkness
- **White/light grey** = snow (may have movement penalty)

Break these codes only intentionally (black sand beach, red volcanic rock) and signal the anomaly clearly.

### Silhouette Readability

Objects must be **readable at a glance** from their silhouette alone. The 8×8 or 16×16 pixel constraint forces this — you get one clear shape. A house is an L-shaped silhouette (wall + roof triangle). A tree is a circle on a stub. A mountain is a triangle. A river is a horizontal strip.

If an element requires more than half a second to identify, simplify the silhouette.

### Walkable vs. Impassable Signaling

Players learn to recognize impassability from visual cues:
- **Dense tree mass** = can't walk through (but lone trees are passable in many games — be consistent)
- **Water** = impassable without boat/bridge
- **Cliff/wall face** = impassable vertical surface
- **Tall grass** (in Pokémon style) = walkable but triggers encounters
- **Solid rock/mountain top** = impassable

The rule: **if it looks solid and tall, it blocks**. Anything flat and below the player's eyeline is walkable.

---

## Reference Games

| Game | Why to Study It |
|---|---|
| [Stardew Valley](https://store.steampowered.com/app/413150/) | Master class in farm zone design; natural-feeling path + building placement; seasonal palette |
| [Pokémon FireRed/Emerald](https://bulbapedia.bulbagarden.net/wiki/Hoenn) | Tight tile economy (16×16 tiles); how routes use bottlenecks; cave-to-outdoor transitions |
| [Zelda: A Link to the Past](https://www.nintendo.com/en-US/store/products/the-legend-of-zelda-a-link-to-the-past-switch/) | Mixed terrain; dungeon entrance placement in world; river/bridge/cliff integration |
| [Tactics Ogre / Final Fantasy Tactics](https://store.steampowered.com/app/1962800/) | Isometric (different projection but same principles); elevation as terrain type |
| [Brotato](https://store.steampowered.com/app/1942280/) | Minimal tile set achieving clear readability with almost no detail |
| [Shovel Knight](https://store.steampowered.com/app/250760/) | How a side-scroller enforces top-down scene reading conventions |

---

## Quick-Reference Rule Sheet (for AI training)

```
PERSPECTIVE
- Use 3/4 oblique view: objects show top + front face
- Vertical = depth: higher on screen = farther from camera
- Shadows fall downward-right consistently

TERRAIN LAYER ORDER (bottom to top)
1. Water (ocean, river, lake)
2. Sand/beach (transition from water to land)
3. Grass/base terrain
4. Dirt path / gravel
5. Paved stone (cobble, slab)
6. Mountain base / cliff
7. Mountain top / impassable rock

TREES
- Dense: round canopies, staggered rows, overlapping
- Sparse: clusters of 3-7 with clear gaps
- Single: accent only, not repeated
- Never: trees in water, trees atop cliff faces

PATHS
- Connect: path → building entrance always
- Width: main road 2-3 tiles, side path 1 tile
- Curve: at least 1-2 bends per screen; no perfectly straight paths
- Intersection: always landmark (sign, well, tree)

BUILDINGS
- Face: south (entrance on bottom face)
- Setback: 1+ tiles of ground between path and building
- Group: 3-5 = hamlet, 8-15+ = town
- Shadow: falls downward from building north edge

FENCES
- Always connect to buildings or other fences — no floating fence ends
- Enclose something: garden, livestock, graveyard
- Gate tiles at entrances

MOUNTAINS
- Stack cliff face tiles vertically with terrace layers
- Caves at cliff base, never cliff top
- Leave gaps: no unbroken mountain wall across entire zone
- Place mountain ranges on north edges; avoid south edges

RIVERS
- Flow generally downhill (southward in 3/4 view)
- Curve: 2-4 bends per screen; no straight rivers
- Must connect to lake, ocean, or other river — no dead ends
- Width: narrow upstream, wider at confluence/delta
- Crossing: bridge/ford at narrowest point perpendicular to flow

BRIDGES
- Perpendicular to river (90°)
- Connect path on both banks
- Railing appears on north side (upper edge of bridge tile)

OCEAN / LAKE
- Beach strip (1-3 tiles) before grass/vegetation
- Color darkens away from shore (depth)
- Irregular coastline — no straight edges

COMPOSITION
- 40-60% ground clear (negative space)
- Every zone: 1-2 leading lines (path, river, fence row)
- Focal point: off-center, large or distinctive object
- Natural cluster sizes: 3-7 trees, 5-15 flowers, 2-3 rocks
- Artificial elements: regular spacing, grid-aligned
- Natural elements: irregular spacing, cluster-based
```

---

## Sources

- slynyrd-top-down-tiles-1.html — Pixelblog 20: ground tile fundamentals
- slynyrd-top-down-tiles-2.html — Pixelblog 43: extended tile techniques
- slynyrd-top-down-objects.html — Pixelblog 21: objects, trees, rocks
- solo-dev-steam-research.md — reference games context
