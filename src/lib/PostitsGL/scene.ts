import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import gsap from 'gsap';
import { Pane } from 'tweakpane';
import postitSvg from '../Postit/postit.svg?raw';

export type PostitData = {
	left: number; // % of paper width
	top: number; // % of paper height
	rotate: number; // deg
};

const SVG_W = 141;
const SVG_H = 100;
const PAPER_W = 1;
const PAPER_H = 297 / 210;
const POSTIT_W = 0.38;
const POSTIT_HALF_W = POSTIT_W / 2;
const POSTIT_SCALE = POSTIT_W / SVG_W;
// Per-layer z step. Kept tiny so stacked stuck postits cast almost no shadow
// onto each other (they read as glued to the wall together). Real shadow
// only appears when one is hovered/dragged, because the curl displacement
// (LIFT_MAX = 0.03) lifts it well above the others.
const Z_STEP = 0.001;

const POSTIT_HALF_H = (SVG_H / 2) * POSTIT_SCALE;
const STICKY_FRACTION = 0.2;
// Geometry is flipped on Y at construction (see buildSharedGeometries) so the
// sticky band ends up at +y under the Y-up camera. STICKY_END_Y is the lower
// boundary of the sticky band in (flipped) geometry coords — anything below
// this curls; anything above stays flat.
const STICKY_END_Y = POSTIT_HALF_H - STICKY_FRACTION * SVG_H * POSTIT_SCALE;
const LIFT_MAX = 0.03; // peak z-lift at the bottom edge
// Tessellation density along Y for the yellow plane. Higher = the
// piecewise-linear yellow surface tracks the curl curve more tightly,
// which shrinks the chord-deviation gap between yellow's segment chords
// and text triangle chords (text has its own independent triangulation).
// 96 keeps z-fight stripes in check during heavy curl without becoming
// a measurable shader-cost.
const PLANE_Y_SEGS = 96;
// Curl is invisible under an orthographic projection unless the paper also
// shortens visibly. Pulling lifted vertices back toward the sticky band fakes
// the foreshortening of the paper rolling toward the viewer.
const CURL_Y_RATIO = 0.4;

const YELLOW = 0xf2f745;
const WHITE = 0xf5f5f0;

type SharedGeometries = {
	yellowBg: THREE.BufferGeometry;
	blackPaths: THREE.BufferGeometry[];
};

function buildSharedGeometries(): SharedGeometries {
	const loader = new SVGLoader();
	const svg = loader.parse(postitSvg);
	const blackPaths: THREE.BufferGeometry[] = [];

	svg.paths.forEach((path, i) => {
		if (i === 0) return; // background replaced by tessellated plane
		const shapes = SVGLoader.createShapes(path);
		shapes.forEach((shape) => {
			// Higher segment count → smoother curve triangulation, fewer
			// visible facet stripes on rounded letterforms.
			const g = new THREE.ShapeGeometry(shape, 64);
			g.translate(-SVG_W / 2, -SVG_H / 2, 0);
			g.scale(POSTIT_SCALE, POSTIT_SCALE, 1);
			// SVG y grows downward; the camera is Y-up. Flip so the SVG's
			// top (sticky band) ends up at +y and lands at the top of the
			// screen. This inverts face winding — the lit material below
			// compensates for that in onBeforeCompile.
			g.scale(1, -1, 1);
			// Tiny static lift to break flat-on-flat z-fight when the
			// postit is stuck (no curl). Must stay well below Z_STEP
			// (0.001) so text on postit N never crosses the yellow plane
			// of postit N+1. The heavy lifting against curl-driven z-
			// fight is done by the curl-proportional textBoost in the
			// shader plus the polygonOffset on the black material.
			g.translate(0, 0, 0.0001);
			blackPaths.push(g);
		});
	});

	const yellowBg = new THREE.PlaneGeometry(
		SVG_W * POSTIT_SCALE,
		SVG_H * POSTIT_SCALE,
		1,
		PLANE_Y_SEGS,
	);
	yellowBg.scale(1, -1, 1);

	return { yellowBg, blackPaths };
}

type LiftUniform = { value: number };

type PostitMaterials = {
	yellow: THREE.MeshLambertMaterial;
	yellowDepth: THREE.MeshDepthMaterial;
	black: THREE.MeshBasicMaterial;
	lift: LiftUniform;
	hoverX: LiftUniform; // -1 (cursor at left edge) … +1 (cursor at right edge)
};

// GLSL injection that bends the postit's bottom up in z and shortens its y
// extent (visible curl under the orthographic camera). Shared by the visible
// material and the shadow-pass depth material so the cast shadow follows the
// curl, not the flat geometry.
//
// Geometry is flipped on Y, so:
//   sticky band is at +y (top)         ≈ +POSTIT_HALF_H
//   sticky/curl boundary               = +STICKY_END_Y
//   free curling bottom                = -POSTIT_HALF_H
function buildCurlInjection(
	lift: LiftUniform,
	hoverX: LiftUniform,
	textBoost = false,
) {
	const stickyEnd = STICKY_END_Y.toFixed(6);
	const posHalfH = POSTIT_HALF_H.toFixed(6);
	const negHalfH = (-POSTIT_HALF_H).toFixed(6);
	const curlY = CURL_Y_RATIO.toFixed(6);
	const halfW = POSTIT_HALF_W.toFixed(6);
	const liftMax = LIFT_MAX.toFixed(6);
	// Black text gets an extra z lift proportional to the yellow plane's
	// own curl displacement. Without it, linear interpolation across text
	// triangles drops below the yellow plane's denser-tessellation curve
	// in the curl's concave region and produces visible stripes through
	// the letters. Tying the boost to curlAmount (instead of just uLift)
	// makes it track asymmetry too — when the cursor is near a side and
	// yellow's curl is amplified up to 2.5×, the text boost scales with
	// it instead of falling behind.
	const textBoostLine = textBoost ? 'transformed.z += curlAmount * 2.5;' : '';

	return (shader: {
		uniforms: Record<string, unknown>;
		vertexShader: string;
	}) => {
		shader.uniforms.uLift = lift;
		shader.uniforms.uHoverX = hoverX;
		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				`#include <common>
				uniform float uLift;
				uniform float uHoverX;`,
			)
			.replace(
				'#include <begin_vertex>',
				`#include <begin_vertex>
				// Two-phase peel:
				//   uLift in [0, LIFT_MAX] (the hover range): peel front
				//     moves bottom → sticky-band boundary. Loose paper
				//     bends progressively; sticky band stays flat.
				//   uLift > LIFT_MAX (pickup over-pull): peel front
				//     continues into the sticky band itself, up toward
				//     posHalfH. The sticky band releases — the whole
				//     postit unsticks from the wall. Full unstick at
				//     uLift = LIFT_MAX * 1.5 (the 0.5 over-range below).
				// Hover ends at the sticky-band boundary; pickup pushes
				// past it.
				float liftN = uLift / ${liftMax};
				float looseT = clamp(liftN, 0.0, 1.0);
				float rawStickyT = clamp((liftN - 1.0) / 0.5, 0.0, 1.0);
				// Ease-in peel front: paper lingers in the loose region
				// before the peel breaches the sticky band, then releases
				// rapidly. Combined with the bell-shaped magnitude surge
				// below, the top edge reads as glued — fighting hardest
				// while the peel is mid-sticky-band, then snapping free.
				float stickyT = pow(rawStickyT, 2.5);
				float peelFrontY = mix(${negHalfH}, ${stickyEnd}, max(looseT, 0.001))
					+ stickyT * (${posHalfH} - ${stickyEnd});
				float curlT = smoothstep(peelFrontY, ${negHalfH}, position.y);
				float curlT2 = curlT * curlT;
				float xNorm = position.x / ${halfW};
				// Slope is 1.0 (not 1.5) so the max(0,…) clamp kink lands
				// exactly at xNorm = ±1 (the postit edge) for the extreme
				// uHoverX = ±1 case. The yellow plane only has 1 X-segment
				// (vertices at xNorm = ±1), so its bilinear interp matches
				// the true asymmetry function across the interior — no
				// chord deviation in X, no z-fight stripes when the cursor
				// is at a side and the curl is at its most asymmetric.
				float asymmetry = max(0.0, 1.0 + uHoverX * xNorm * 1.0);
				// Magnitude has two regimes:
				//   Hover (liftN 0→1): peels with full torsion, peaks at
				//     LIFT_MAX so the peel reads strongly even before
				//     committing to a pickup.
				//   Pickup (liftN 1→1.5): bell-shaped surge starting from
				//     LIFT_MAX (continuous with hover peak so there's no
				//     pop at the transition), peaking while the peel
				//     front is mid-sticky-band (where glue resistance is
				//     strongest), then dropping to LIFT_MAX * 0.2 once
				//     the band releases — at that point the global
				//     unstick lift below carries the postit forward
				//     instead of curling it harder.
				float hoverMag = looseT * ${liftMax} * 1.0;
				float fightBell = 4.0 * stickyT * (1.0 - stickyT);
				float pickupMag = mix(${liftMax}, ${liftMax} * 0.2, rawStickyT)
					+ fightBell * ${liftMax} * 0.9;
				float magnitude = mix(hoverMag, pickupMag, step(1.0, liftN));
				float curlAmount = curlT2 * magnitude * asymmetry;
				transformed.y += curlAmount * ${curlY};
				transformed.z += curlAmount;
				// Global unstick lift: when the sticky band releases
				// (stickyT > 0), the whole paper translates outward in z
				// — toward the camera, away from the wall. The ortho
				// camera flattens the z move on screen, but the shadow
				// it casts on the wall slides away from the postit edge,
				// which is what reads visually as "off the wall." The
				// multiplier is intentionally aggressive (3 × LIFT_MAX)
				// so the gap between the postit and its shadow is the
				// dominant visual at peak unstick.
				transformed.z += stickyT * ${liftMax} * 3.0;
				${textBoostLine}`,
			);
	};
}

function makePostitMaterials(): PostitMaterials {
	const lift: LiftUniform = { value: 0 };
	const hoverX: LiftUniform = { value: 0 };
	const injectCurl = buildCurlInjection(lift, hoverX, false);
	const injectCurlText = buildCurlInjection(lift, hoverX, true);

	const yellow = new THREE.MeshLambertMaterial({
		color: YELLOW,
		side: THREE.DoubleSide,
	});
	// Two injections in one onBeforeCompile:
	//  1. vertex curl (smoothstep + uLift)
	//  2. fragment normal_fragment_begin override — geometry was flipped to
	//     fix orientation under the Y-up camera, which inverts winding.
	//     Lambert's DOUBLE_SIDED branch would then multiply the normal by
	//     faceDirection=-1 and zero the directional contribution.
	yellow.onBeforeCompile = (shader) => {
		injectCurl(shader);
		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <normal_fragment_begin>',
			`
			float faceDirection = 1.0;
			vec3 normal = normalize( vNormal );
			vec3 nonPerturbedNormal = normal;
			`,
		);
	};
	// DoubleSide for shadow casting since the visual face reads as back-facing
	// in NDC after the geometry flip.
	yellow.shadowSide = THREE.DoubleSide;

	// Custom depth material for the shadow pass — same vertex curl so the cast
	// shadow follows the curled paper rather than the flat plane.
	const yellowDepth = new THREE.MeshDepthMaterial({
		depthPacking: THREE.RGBADepthPacking,
		side: THREE.DoubleSide,
	});
	yellowDepth.onBeforeCompile = (shader) => injectCurl(shader);

	const black = new THREE.MeshBasicMaterial({
		color: 0x000000,
		side: THREE.DoubleSide,
		// No polygonOffset: even with factor=0, units interpretation isn't
		// perfectly portable across GPUs and can overshoot Z_STEP in some
		// configurations, causing text from one postit to leak in front of
		// the next. Z separation is handled entirely in object space:
		//   • static 0.0001 translate (in buildSharedGeometries) for flat
		//     state (uLift=0)
		//   • curlAmount * 1.5 in the vertex shader for curled state
		// Both are bounded and stay well below Z_STEP.
	});
	black.onBeforeCompile = (shader) => injectCurlText(shader);

	return { yellow, yellowDepth, black, lift, hoverX };
}

export function createScene(canvas: HTMLCanvasElement, postits: PostitData[]) {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(WHITE);

	// Perspective camera, framed so the paper plane (z=0) fills exactly the
	// same PAPER_W × PAPER_H region the previous ortho cam covered. The
	// 30° FOV is narrow enough that postits near the edges don't distort
	// noticeably, but wide enough that z-lifted postits (drag state) visibly
	// scale up — the cue that was missing under ortho, where z only shifted
	// the shadow. The camera distance is derived from the FOV so a future
	// FOV tweak doesn't require re-zeroing the framing.
	const FOV_DEG = 30;
	const aspect = PAPER_W / PAPER_H;
	const cameraDistance =
		PAPER_H / 2 / Math.tan((FOV_DEG * Math.PI) / 180 / 2);
	const camera = new THREE.PerspectiveCamera(FOV_DEG, aspect, 0.1, 100);
	camera.position.set(PAPER_W / 2, PAPER_H / 2, cameraDistance);
	camera.lookAt(PAPER_W / 2, PAPER_H / 2, 0);

	const sharedGeos = buildSharedGeometries();

	const groups: THREE.Group[] = [];
	const mats: PostitMaterials[] = [];
	const yellowMeshes: THREE.Mesh[] = [];

	// Tweakpane-tunable params. Held on an object so addBinding can mutate
	// them; consumed in onPointerDown / onPointerUp at gesture time, so live
	// edits take effect on the next grab without needing a re-render.
	const dragParams = {
		liftZ: 0.025,
	};

	postits.forEach((p, idx) => {
		const m = makePostitMaterials();
		const g = new THREE.Group();

		const yellowMesh = new THREE.Mesh(sharedGeos.yellowBg, m.yellow);
		yellowMesh.castShadow = true;
		yellowMesh.receiveShadow = true;
		yellowMesh.customDepthMaterial = m.yellowDepth;
		g.add(yellowMesh);
		yellowMeshes.push(yellowMesh);

		sharedGeos.blackPaths.forEach((geom) =>
			g.add(new THREE.Mesh(geom, m.black)),
		);

		// Each postit gets its own depth layer. Y is flipped because PostitData
		// uses CSS-style "top % from top of paper" but the camera is Y-up.
		g.position.set(
			(p.left / 100) * PAPER_W,
			(1 - p.top / 100) * PAPER_H,
			idx * Z_STEP,
		);
		g.rotation.z = (p.rotate * Math.PI) / 180;
		scene.add(g);
		groups.push(g);
		mats.push(m);
	});

	// ---------- Native shadow setup ----------
	// Wall plane behind the postits receives shadows; postits cast onto it.
	// ShadowMaterial renders only the shadow term as a transparent darkening,
	// so the scene background stays visible elsewhere.
	const wall = new THREE.Mesh(
		new THREE.PlaneGeometry(PAPER_W * 3, PAPER_H * 3),
		new THREE.ShadowMaterial({ opacity: 0.18 }),
	);
	// Wall close behind the postits — the smaller the gap, the tighter the
	// shadow tucks under the postit edge.
	wall.position.set(PAPER_W / 2, PAPER_H / 2, -0.005);
	wall.receiveShadow = true;
	scene.add(wall);

	// High ambient + low directional: the postit reads as full YELLOW under
	// lit areas (ambient + dir·ndotl saturates to 1) while shadowed areas
	// only lose the directional contribution — a subtle but visible
	// darkening on postit-on-postit overlap.
	const ambient = new THREE.AmbientLight(0xffffff, 0.8);
	scene.add(ambient);

	const sun = new THREE.DirectionalLight(0xffffff, 2.5);
	// Upper-left: small x, large y (since camera is Y-up now).
	sun.position.set(-0.47, PAPER_H, 2.5);
	sun.target.position.set(PAPER_W / 2, PAPER_H / 2, 0);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -1.2;
	sun.shadow.camera.right = 1.2;
	sun.shadow.camera.top = 1.2;
	sun.shadow.camera.bottom = -1.2;
	sun.shadow.camera.near = 0.1;
	sun.shadow.camera.far = 4;
	// normalBias must stay below the postit-to-postit z-step (Z_STEP) or the
	// receiver's check overshoots the caster's depth and postit-on-postit
	// shadow disappears. Also clears self-shadow stripes from the curl.
	sun.shadow.bias = 0;
	sun.shadow.normalBias = 0.001;
	// Larger radius = softer PCF blur, less crispy shadow edge.
	sun.shadow.radius = 2.0;
	scene.add(sun);
	scene.add(sun.target);

	const debug =
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('debug') === '1';
	let lightHelper: THREE.DirectionalLightHelper | null = null;
	let camHelper: THREE.CameraHelper | null = null;
	if (debug) {
		lightHelper = new THREE.DirectionalLightHelper(sun, 0.15);
		camHelper = new THREE.CameraHelper(sun.shadow.camera);
		scene.add(lightHelper);
		scene.add(camHelper);
	}

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: false,
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;

	let needsRender = true;
	let raf = 0;
	const requestRender = () => {
		needsRender = true;
	};

	function resize() {
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		renderer.setSize(rect.width, rect.height, false);
		requestRender();
	}

	function tick() {
		raf = requestAnimationFrame(tick);
		if (needsRender) {
			renderer.render(scene, camera);
			needsRender = false;
		}
	}

	resize();
	tick();

	const ro = new ResizeObserver(resize);
	ro.observe(canvas);

	gsap.ticker.add(requestRender);

	// ---------- Debug controls (tweakpane) ----------
	let pane: Pane | null = null;
	//if (debug) {
	pane = new Pane({ title: 'Light' });

	const onLightChange = () => {
		sun.target.updateMatrixWorld();
		sun.shadow.camera.updateProjectionMatrix();
		lightHelper?.update();
		camHelper?.update();
		requestRender();
	};

	const sunFolder = pane.addFolder({ title: 'Sun' });
	sunFolder
		.addBinding(sun.position, 'x', { min: -2, max: 2, step: 0.001 })
		.on('change', onLightChange);
	sunFolder
		.addBinding(sun.position, 'y', { min: -2, max: 2, step: 0.001 })
		.on('change', onLightChange);
	sunFolder
		.addBinding(sun.position, 'z', { min: 0.01, max: 3, step: 0.001 })
		.on('change', onLightChange);
	sunFolder
		.addBinding(sun, 'intensity', { min: 0, max: 4, step: 0.05 })
		.on('change', requestRender);

	const shadowFolder = pane.addFolder({ title: 'Shadow' });
	shadowFolder.addBinding(sun, 'castShadow').on('change', requestRender);
	shadowFolder
		.addBinding(sun.shadow, 'radius', { min: 0, max: 20, step: 0.5 })
		.on('change', requestRender);
	shadowFolder
		.addBinding(sun.shadow, 'bias', {
			min: -0.01,
			max: 0.01,
			step: 0.0001,
		})
		.on('change', requestRender);
	shadowFolder
		.addBinding(sun.shadow, 'normalBias', {
			min: 0,
			max: 0.1,
			step: 0.001,
		})
		.on('change', requestRender);
	const wallMat = wall.material as THREE.ShadowMaterial;
	shadowFolder
		.addBinding(wallMat, 'opacity', { min: 0, max: 1, step: 0.01 })
		.on('change', requestRender);
	shadowFolder
		.addBinding(ambient, 'intensity', { min: 0, max: 4, step: 0.05 })
		.on('change', requestRender);
	shadowFolder
		.addBinding(wall.position, 'z', {
			min: -0.3,
			max: -0.001,
			step: 0.001,
		})
		.on('change', requestRender);

	const dragFolder = pane.addFolder({ title: 'Drag' });
	dragFolder.addBinding(dragParams, 'liftZ', {
		label: 'lift z',
		min: 0.0,
		max: 0.5,
		step: 0.001,
	});
	//}

	// ---------- Drag swing (velocity-driven tilt) ----------
	// Each frame: decay the horizontal velocity, compute a bounded tilt
	// (tanh-saturated so quick flicks don't over-rotate), and lerp the
	// dragged postit's rotation.z toward pickupR + tilt. Centered on
	// pickupR (the twisted angle from grab) so the swing oscillates
	// around the new orientation, not the pre-grab one.
	function updateDragSwing() {
		if (!dragging) return;
		// Skip while the pickup timeline is still tweening rotation, or our
		// 20% lerp fights the gsap tween frame-by-frame and produces a
		// visible rebound on grab.
		if (dragStartTimeline) return;
		velocityX *= 0.85;
		// Saturate around ~10° max swing (0.18 rad).
		const tilt = Math.tanh(velocityX * 0.4) * 0.18;
		const target = pickupR - tilt;
		dragging.rotation.z += (target - dragging.rotation.z) * 0.2;
		requestRender();
	}
	gsap.ticker.add(updateDragSwing);

	// ---------- Coverage + hover state ----------

	const aabbs: THREE.Box3[] = groups.map(() => new THREE.Box3());
	const covered: boolean[] = groups.map(() => false);
	let hoveredIndex = -1;
	let draggingIndex = -1;
	// Postit just released from a drag — flat ("stuck") until the cursor
	// leaves and re-enters, regardless of hover state.
	let stuckIndex = -1;
	// Postit currently in the post-drop rotation phase. Lift is held at
	// LIFT_MAX during rotation so the postit can't visually "stick" until
	// it has finished orienting itself.
	let transitioningIndex = -1;
	// Postit whose drop animation is currently sequencing through the two
	// phases (top-stick → rest-falls). applyTargets skips this index so its
	// lift uniform stays under the timeline's control while other postits'
	// coverage updates run normally.
	let droppingIndex = -1;
	let transitionTimeline: gsap.core.Timeline | null = null;
	let dragStartTimeline: gsap.core.Timeline | null = null;
	// quickTo handlers for smooth cursor-follow on the dragged postit's xy.
	// Created at drag start, cleared on drag end.
	let xTo: ((value: number) => void) | null = null;
	let yTo: ((value: number) => void) | null = null;

	function isAbove(j: number, i: number): boolean {
		const a = groups[j].position.z;
		const b = groups[i].position.z;
		if (a !== b) return a > b;
		return j > i;
	}

	function overlap2D(a: THREE.Box3, b: THREE.Box3): boolean {
		return (
			a.min.x < b.max.x &&
			a.max.x > b.min.x &&
			a.min.y < b.max.y &&
			a.max.y > b.min.y
		);
	}

	function recomputeCoverage() {
		for (let i = 0; i < groups.length; i++)
			aabbs[i].setFromObject(groups[i]);
		for (let i = 0; i < groups.length; i++) {
			let c = false;
			for (let j = 0; j < groups.length; j++) {
				if (i === j) continue;
				if (!isAbove(j, i)) continue;
				if (overlap2D(aabbs[i], aabbs[j])) {
					c = true;
					break;
				}
			}
			covered[i] = c;
		}
	}

	function targetLiftFor(i: number): number {
		if (covered[i]) return 0;
		// Dragging takes priority over the stuck flag — re-grabbing a
		// just-dropped postit immediately peels it again.
		if (i === draggingIndex) return LIFT_MAX;
		// Hold the curl during the post-drop rotation phase; the stick only
		// begins after rotation finishes.
		if (i === transitioningIndex) return LIFT_MAX;
		if (i === stuckIndex) return 0;
		if (i === hoveredIndex) return LIFT_MAX;
		return 0;
	}

	function applyTargets() {
		for (let i = 0; i < groups.length; i++) {
			// The dragged postit's lift is owned by the drag-start timeline
			// (curl overshoot for the peel feel). Skip here so we don't fight
			// that tween on every coverage update during drag.
			if (i === draggingIndex) continue;
			// The dropping postit's lift is owned by the drop timeline
			// (two-step retraction: top-stick then rest-falls). Same gate.
			if (i === droppingIndex) continue;
			const target = targetLiftFor(i);
			const u = mats[i].lift;
			const mesh = yellowMeshes[i];
			// Disable self-shadow as soon as the postit starts lifting — the
			// curl creates depth variation across each shadow-map texel and
			// PCF would average it into visible stripe banding on the
			// curling surface. Re-enable once it has fully settled flat.
			if (target > 0) mesh.receiveShadow = false;
			if (u.value === target) continue;
			gsap.killTweensOf(u);
			gsap.to(u, {
				value: target,
				// Faster ramp on lift-up so the peel feels immediate;
				// drop-back keeps the slower power2.out for the stick feel.
				duration: target > 0 ? 0.25 : 0.45,
				ease: 'power2.out',
				onUpdate: requestRender,
				onComplete: () => {
					if (target === 0) {
						mesh.receiveShadow = true;
						requestRender();
					}
				},
			});
		}
	}

	function updateCoverageAndLifts() {
		recomputeCoverage();
		applyTargets();
	}

	updateCoverageAndLifts();

	// ---------- Drag + hover handling ----------

	const raycaster = new THREE.Raycaster();
	const ndc = new THREE.Vector2();

	let dragging: THREE.Group | null = null;
	const startWorld = new THREE.Vector2();
	const startPos = new THREE.Vector2();
	let originalR = 0;
	// Twisted angle picked at grab time. The pickup tween rotates from
	// originalR → pickupR (twist on grab); the drag swing oscillates around
	// pickupR; on drop a real drag settles back to pickupR while a click
	// reverts to originalR (untwist).
	let pickupR = 0;
	// Stack rank per postit: 0 = bottom layer, postits.length - 1 = top.
	// Rank shifts on each grab so the most-recently-touched postit lands
	// at the top without z accumulating globally — drop z stays bounded
	// at (postits.length - 1) * Z_STEP no matter how many grabs happened.
	const stackRank: number[] = postits.map((_, idx) => idx);
	const TOP_RANK = postits.length - 1;
	function bringToTop(idx: number) {
		const oldRank = stackRank[idx];
		if (oldRank === TOP_RANK) return;
		for (let i = 0; i < stackRank.length; i++) {
			if (i === idx) continue;
			if (stackRank[i] > oldRank) {
				stackRank[i] -= 1;
				groups[i].position.z = stackRank[i] * Z_STEP;
			}
		}
		stackRank[idx] = TOP_RANK;
	}

	let pointerDownTime = 0;
	// Below this hold-time threshold we treat the gesture as a click: the
	// postit jumps to the top of the stack and untwists back to originalR.
	const CLICK_THRESHOLD_MS = 200;
	// Drag-swing state: tilt the postit while dragging based on horizontal
	// cursor velocity. Decays toward pickupR when motion stops.
	let velocityX = 0;
	let lastMoveX = 0;
	let lastMoveTime = 0;

	function getWorld(clientX: number, clientY: number, out: THREE.Vector2) {
		const rect = canvas.getBoundingClientRect();
		out.x = ((clientX - rect.left) / rect.width) * PAPER_W;
		// Flip y: screen-down = world-down (smaller world y) under Y-up camera.
		out.y = PAPER_H - ((clientY - rect.top) / rect.height) * PAPER_H;
	}

	function setNdc(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
	}

	function setHoverX(idx: number, worldX: number, worldY: number) {
		const g = groups[idx];
		const dx = worldX - g.position.x;
		const dy = worldY - g.position.y;
		// Inverse-rotate to local space (group only rotates around z).
		const c = Math.cos(g.rotation.z);
		const s = Math.sin(g.rotation.z);
		const lx = c * dx + s * dy;
		const u = mats[idx].hoverX;
		gsap.killTweensOf(u);
		u.value = Math.max(-1, Math.min(1, lx / POSTIT_HALF_W));
	}

	function releaseHoverX(idx: number) {
		if (idx < 0) return;
		const u = mats[idx].hoverX;
		gsap.killTweensOf(u);
		gsap.to(u, {
			value: 0,
			duration: 0.45,
			ease: 'power2.out',
			onUpdate: requestRender,
		});
	}

	function pickTopGroupIndex(): number {
		const sorted = groups
			.map((g, i) => ({ g, i }))
			.sort((a, b) => {
				if (a.g.position.z !== b.g.position.z)
					return b.g.position.z - a.g.position.z;
				return b.i - a.i;
			});
		for (const { g, i } of sorted) {
			const hits = raycaster.intersectObject(g, true);
			if (hits.length > 0) return i;
		}
		return -1;
	}

	function onPointerDown(e: PointerEvent) {
		setNdc(e.clientX, e.clientY);
		raycaster.setFromCamera(ndc, camera);
		const idx = pickTopGroupIndex();
		if (idx === -1) return;
		dragging = groups[idx];
		draggingIndex = idx;

		e.preventDefault();
		canvas.setPointerCapture(e.pointerId);
		gsap.killTweensOf(dragging.position);
		gsap.killTweensOf(dragging.scale);
		gsap.killTweensOf(dragging.rotation);
		gsap.killTweensOf(mats[idx].lift);
		// If this same postit is mid post-drop transition, cancel the
		// rotation/stick sequence so the new drag can take over cleanly.
		if (idx === transitioningIndex) {
			transitionTimeline?.kill();
			transitionTimeline = null;
			transitioningIndex = -1;
		}
		dragStartTimeline?.kill();

		getWorld(e.clientX, e.clientY, startWorld);
		startPos.set(dragging.position.x, dragging.position.y);
		setHoverX(idx, startWorld.x, startWorld.y);
		originalR = dragging.rotation.z;
		pickupR = originalR;
		// Reset swing state for this drag.
		velocityX = 0;
		lastMoveX = startWorld.x;
		lastMoveTime = performance.now();
		pointerDownTime = lastMoveTime;

		// Promote the grabbed postit to the top of the stack and shift
		// every postit that was above it down by one rank — instant z
		// updates, but each of those is just one Z_STEP (≈ 0.038% scale
		// change under the perspective cam, imperceptible). Drop z is
		// then bounded at TOP_RANK * Z_STEP no matter how many grabs.
		bringToTop(idx);
		// Target z for the dragged postit during the drag — visibly lifted
		// toward the viewer under the perspective cam. Tweened in the
		// drag-start timeline below; under perspective an instant z change
		// shows up as an instant scale jump on grab. Read off dragParams
		// so tweakpane edits take effect on the next grab.
		const targetDragZ = dragParams.liftZ;

		// Smooth cursor-follow on xy with a tight smoothing window so the
		// drag feels immediate but not jittery.
		xTo = gsap.quickTo(dragging.position, 'x', {
			duration: 0.06,
			ease: 'power2.out',
		});
		yTo = gsap.quickTo(dragging.position, 'y', {
			duration: 0.06,
			ease: 'power2.out',
		});

		updateCoverageAndLifts();

		// Drag-start timeline owns the lift uniform during pickup (see the
		// gate in applyTargets that skips the dragged postit). Only the
		// curl is animated — z is already at the top layer (set instantly
		// above), rotation is left alone for the swing to handle.
		const tl = gsap.timeline({
			onUpdate: requestRender,
			onComplete: () => {
				dragStartTimeline = null;
			},
		});
		// Pickup is the same shape as hover (curl propagating from bottom
		// up) but more dramatic and pushed past where hover stops:
		//   • Hover ramps uLift to LIFT_MAX → peel front lands at the
		//     sticky-band boundary, loose paper fully bent.
		//   • Pickup ramps uLift to LIFT_MAX * 1.5 → the over-pull drives
		//     the peel front into the sticky band itself (see shader),
		//     amplifies the curl magnitude (more torsion at the bottom),
		//     and triggers the global unstick lift that translates the
		//     previously-stuck top edge upward and outward.
		// power3.out concentrates time near the end of the ramp, where
		// the peel is climbing through the sticky band and the global
		// lift is engaging — that tail is the "glue resistance" to the
		// final unstick. Rotation is not touched on grab; the only
		// rotation during a gesture is the velocity-driven swing in
		// updateDragSwing while the user actually moves the cursor.
		tl.to(
			mats[idx].lift,
			{
				value: LIFT_MAX * 1.5,
				duration: 0.5,
				ease: 'power3.out',
				onUpdate: requestRender,
			},
			0,
		);
		// Smooth z lift toward targetDragZ. Snapping z under the
		// perspective cam manifests as an instant scale jump on grab;
		// tweening on the same arc as the curl makes the postit appear to
		// rise toward the viewer in step with the peel. Layering settles
		// within the first ~100ms of the power3.out curve since z
		// surpasses every other postit very early.
		tl.to(
			dragging.position,
			{
				z: targetDragZ,
				duration: 0.5,
				ease: 'power3.out',
			},
			0,
		);
		dragStartTimeline = tl;
	}

	const wp = new THREE.Vector2();
	function onPointerMove(e: PointerEvent) {
		if (dragging) {
			getWorld(e.clientX, e.clientY, wp);
			// Update horizontal velocity from this pointer event for the
			// drag-swing tilt. Low-pass filter so single-frame jitter doesn't
			// flick the rotation.
			const now = performance.now();
			if (lastMoveTime > 0) {
				const dt = (now - lastMoveTime) / 1000;
				if (dt > 0) {
					const instant = (wp.x - lastMoveX) / dt;
					velocityX = velocityX * 0.5 + instant * 0.5;
				}
			}
			lastMoveX = wp.x;
			lastMoveTime = now;
			const dx = wp.x - startWorld.x;
			const dy = wp.y - startWorld.y;
			const targetX = Math.max(0, Math.min(PAPER_W, startPos.x + dx));
			const targetY = Math.max(0, Math.min(PAPER_H, startPos.y + dy));
			if (xTo && yTo) {
				xTo(targetX);
				yTo(targetY);
			} else {
				dragging.position.x = targetX;
				dragging.position.y = targetY;
			}
			// Cursor offset relative to the dragged postit stays fixed during
			// drag, so the curl bias keeps pointing at the grabbed side.
			setHoverX(draggingIndex, wp.x, wp.y);
			updateCoverageAndLifts();
			requestRender();
			return;
		}
		// Hover detection
		setNdc(e.clientX, e.clientY);
		raycaster.setFromCamera(ndc, camera);
		const idx = pickTopGroupIndex();
		if (idx !== hoveredIndex) {
			if (hoveredIndex !== -1) releaseHoverX(hoveredIndex);
			// Cursor moved off the just-dropped postit → un-stick it so a
			// future re-hover can peel it again.
			if (stuckIndex !== -1 && hoveredIndex === stuckIndex) {
				stuckIndex = -1;
			}
			hoveredIndex = idx;
			applyTargets();
		}
		if (idx !== -1) {
			getWorld(e.clientX, e.clientY, wp);
			setHoverX(idx, wp.x, wp.y);
			requestRender();
		}
	}

	function onPointerUp() {
		if (!dragging) return;
		const d = dragging;
		const droppedIdx = draggingIndex;
		releaseHoverX(droppedIdx);
		transitioningIndex = droppedIdx;
		// Take ownership of this postit's lift uniform for the whole drop
		// sequence. applyTargets is gated on droppingIndex, so coverage
		// updates can't interrupt the two-phase tween below.
		droppingIndex = droppedIdx;
		dragging = null;
		draggingIndex = -1;
		// Stop tracking cursor so a stray pointermove can't yank the
		// no-longer-dragged postit's xy.
		xTo = null;
		yTo = null;
		gsap.killTweensOf(d.scale);
		gsap.killTweensOf(d.rotation);
		gsap.killTweensOf(mats[droppedIdx].lift);
		transitionTimeline?.kill();
		dragStartTimeline?.kill();
		dragStartTimeline = null;

		// Click vs drag: short hold reverts the pickup-twist back to the
		// pre-grab angle (postit "settles flat"); a real drag settles the
		// swing-tilt back to pickupR (the twisted angle is kept).
		const heldDuration = performance.now() - pointerDownTime;
		const isClick = heldDuration < CLICK_THRESHOLD_MS;
		const dropR = isClick ? originalR : pickupR;

		const tl = gsap.timeline({
			onComplete: () => {
				transitionTimeline = null;
			},
		});
		// Two-step drop:
		//   Phase 1 (top sticks): uLift retracts from peak (peel front in
		//     the sticky band) back to LIFT_MAX. The shader's ease-in
		//     stickyT pulls peelFrontY out of the sticky band quickly,
		//     so the top edge re-engages while the loose paper is still
		//     curled. Rotation + z run in parallel — postit lands at its
		//     resting angle/depth as the sticky band re-attaches.
		//   Phase 2 (rest falls): uLift continues from LIFT_MAX to 0.
		//     Peel front slides back through the loose region to the
		//     bottom edge. Slower than the standard ramp so the unstick
		//     reads legibly in reverse.
		const rotDistance = Math.abs(dropR - d.rotation.z);
		const rotDuration = Math.min(0.8, rotDistance * 3);
		const targetRestZ = stackRank[droppedIdx] * Z_STEP;
		const zDuration = 0.5;
		const PHASE1_LIFT_DURATION = 0.6;
		const PHASE2_LIFT_DURATION = 0.8;
		const phase1End = Math.max(
			rotDuration,
			zDuration,
			PHASE1_LIFT_DURATION,
		);
		tl.to(
			mats[droppedIdx].lift,
			{
				value: LIFT_MAX,
				duration: PHASE1_LIFT_DURATION,
				ease: 'power2.inOut',
				onUpdate: requestRender,
			},
			0,
		);
		tl.to(
			d.rotation,
			{
				z: dropR,
				duration: rotDuration,
				ease: 'power2.inOut',
				onUpdate: requestRender,
			},
			0,
		);
		tl.to(
			d.position,
			{
				z: targetRestZ,
				duration: zDuration,
				ease: 'power2.inOut',
				onUpdate: requestRender,
			},
			0,
		);
		tl.call(
			() => {
				transitioningIndex = -1;
				stuckIndex = droppedIdx;
				// Recompute coverage + sync other postits' lift state.
				// droppingIndex is still set, so applyTargets skips this
				// postit and leaves phase 2 tween alone.
				updateCoverageAndLifts();
				requestRender();
			},
			undefined,
			phase1End,
		);
		tl.to(
			mats[droppedIdx].lift,
			{
				value: 0,
				duration: PHASE2_LIFT_DURATION,
				ease: 'power2.inOut',
				onUpdate: requestRender,
				onComplete: () => {
					droppingIndex = -1;
					yellowMeshes[droppedIdx].receiveShadow = true;
					requestRender();
				},
			},
			phase1End,
		);
		transitionTimeline = tl;
	}

	function onPointerLeave() {
		if (hoveredIndex !== -1) {
			releaseHoverX(hoveredIndex);
			if (hoveredIndex === stuckIndex) stuckIndex = -1;
			hoveredIndex = -1;
			applyTargets();
		}
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointerleave', onPointerLeave);
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);

	return {
		destroy() {
			cancelAnimationFrame(raf);
			gsap.ticker.remove(requestRender);
			gsap.ticker.remove(updateDragSwing);
			ro.disconnect();
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			sharedGeos.yellowBg.dispose();
			sharedGeos.blackPaths.forEach((g) => g.dispose());
			mats.forEach((m) => {
				m.yellow.dispose();
				m.yellowDepth.dispose();
				m.black.dispose();
			});
			wall.geometry.dispose();
			(wall.material as THREE.Material).dispose();
			sun.dispose();
			if (lightHelper) {
				scene.remove(lightHelper);
				lightHelper.dispose();
			}
			if (camHelper) {
				scene.remove(camHelper);
				camHelper.dispose();
			}
			pane?.dispose();
			renderer.dispose();
		},
	};
}
