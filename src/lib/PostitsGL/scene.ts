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
const SVG_H = 60;
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
const PLANE_Y_SEGS = 32;
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
			// Tiny static offset just to break the flat-on-flat z-fight when
			// the postit is stuck (no curl). The dynamic offset that scales
			// with uLift is added in the black material's vertex shader so
			// chord-deviation stripes stay away during curl.
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
	const negHalfH = (-POSTIT_HALF_H).toFixed(6);
	const curlY = CURL_Y_RATIO.toFixed(6);
	const halfW = POSTIT_HALF_W.toFixed(6);
	// Black text gets an extra z lift that scales with the curl. Without it,
	// linear interpolation across text triangles drops below the yellow
	// plane's denser-tessellation curve in the curl's concave region and
	// produces visible stripes through the letters.
	const textBoostLine = textBoost ? 'transformed.z += uLift * 0.3;' : '';

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
				float curlT = smoothstep(${stickyEnd}, ${negHalfH}, position.y);
				float curlT2 = curlT * curlT;
				float xNorm = position.x / ${halfW};
				float asymmetry = max(0.0, 1.0 + uHoverX * xNorm * 1.5);
				float curlAmount = curlT2 * uLift * asymmetry;
				transformed.y += curlAmount * ${curlY};
				transformed.z += curlAmount;
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
	});
	black.onBeforeCompile = (shader) => injectCurlText(shader);

	return { yellow, yellowDepth, black, lift, hoverX };
}

export function createScene(canvas: HTMLCanvasElement, postits: PostitData[]) {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(WHITE);

	// Standard Y-up ortho cam (top=PAPER_H, bottom=0). The previous Y-down
	// setup (top=0, bottom=PAPER_H) was breaking three.js's directional-light
	// view-space transform, which is why no shadow appeared and Sun > intensity
	// had no effect. Postit positions and pointer mapping are flipped below.
	const camera = new THREE.OrthographicCamera(
		0,
		PAPER_W,
		PAPER_H,
		0,
		-100,
		100,
	);
	camera.position.z = 10;

	const sharedGeos = buildSharedGeometries();

	const groups: THREE.Group[] = [];
	const mats: PostitMaterials[] = [];
	const yellowMeshes: THREE.Mesh[] = [];

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
	sun.position.set(0.33, PAPER_H - 0.15, 2.0);
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
	sun.shadow.normalBias = 0.0005;
	// Larger radius = softer PCF blur, less crispy shadow edge.
	sun.shadow.radius = 2;
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
		.addBinding(sun.position, 'z', { min: 0.01, max: 2, step: 0.001 })
		.on('change', onLightChange);
	sunFolder
		.addBinding(sun, 'intensity', { min: 0, max: 3, step: 0.05 })
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
		.addBinding(ambient, 'intensity', { min: 0, max: 1.5, step: 0.05 })
		.on('change', requestRender);
	shadowFolder
		.addBinding(wall.position, 'z', {
			min: -0.3,
			max: -0.001,
			step: 0.001,
		})
		.on('change', requestRender);
	//}

	// ---------- Drag swing (velocity-driven tilt) ----------
	// Each frame: decay the horizontal velocity, compute a bounded tilt
	// (tanh-saturated so quick flicks don't over-rotate), and lerp the
	// dragged postit's rotation.z toward originalR + tilt.
	function updateDragSwing() {
		if (!dragging) return;
		velocityX *= 0.85;
		// Saturate around ~10° max swing (0.18 rad).
		const tilt = Math.tanh(velocityX * 0.4) * 0.18;
		const target = originalR - tilt;
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
	let dropR = 0;
	let topZ = postits.length;
	let pointerDownTime = 0;
	// Below this hold-time threshold we treat the gesture as a click: the
	// postit jumps to the top of the stack but doesn't rotate.
	const CLICK_THRESHOLD_MS = 200;
	// Drag-swing state: tilt the postit while dragging based on horizontal
	// cursor velocity. Decays toward originalR when motion stops.
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
		dropR = originalR + ((Math.random() - 0.5) * 14 * Math.PI) / 180;
		// Reset swing state for this drag.
		velocityX = 0;
		lastMoveX = startWorld.x;
		lastMoveTime = performance.now();
		pointerDownTime = lastMoveTime;

		topZ += 1;

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

		const d = dragging;
		// Drag-start timeline: torsion peel → unstick (z) → rotate.
		// Curl uniform is already ramping 0 → LIFT_MAX via applyTargets in
		// parallel; the timeline holds z + rotation off the wall while the
		// peel develops, then sequences them.
		const tl = gsap.timeline({
			onUpdate: requestRender,
			onComplete: () => {
				dragStartTimeline = null;
			},
		});
		// Phase 1 (0 – 0.16s): peel torsion grows. Subtle scale "press in"
		// while the sticky band still holds.
		tl.to(
			d.scale,
			{
				x: 1.004,
				y: 1.004,
				z: 1.004,
				duration: 0.16,
				ease: 'power3.in',
			},
			0,
		);
		// Phase 2 (0.16 – 0.32s): sticky band releases. z rises and scale
		// pops past 1.0 so the postit "lifts off" the wall.
		tl.to(
			d.position,
			{
				z: topZ * Z_STEP,
				duration: 0.16,
				ease: 'expo.out',
			},
			0.16,
		);
		tl.to(
			d.scale,
			{
				x: 1.03,
				y: 1.03,
				z: 1.03,
				duration: 0.18,
				ease: 'power2.out',
			},
			0.16,
		);
		// Phase 3 (0.32 – 0.5s): scale settles to the slightly-larger drag
		// scale. No rotation here — rotation only happens on drop, so the
		// postit holds its current angle while being dragged.
		tl.to(
			d.scale,
			{
				x: 1.02,
				y: 1.02,
				z: 1.02,
				duration: 0.18,
				ease: 'power1.out',
			},
			0.32,
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
		// Phase 1 (rotation only): postit holds curl + scale, rotates to its
		// final orientation. transitioningIndex keeps targetLiftFor pinned at
		// LIFT_MAX so the stick can't begin yet.
		transitioningIndex = droppedIdx;
		dragging = null;
		draggingIndex = -1;
		// Stop tracking cursor so a stray pointermove can't yank the
		// no-longer-dragged postit's xy.
		xTo = null;
		yTo = null;
		gsap.killTweensOf(d.scale);
		gsap.killTweensOf(d.rotation);
		transitionTimeline?.kill();
		dragStartTimeline?.kill();

		// Click vs drag: short hold counts as a click — the postit just
		// jumps to the top of the stack without rotation.
		const heldDuration = performance.now() - pointerDownTime;
		if (heldDuration < CLICK_THRESHOLD_MS) {
			dropR = d.rotation.z; // suppress rotation
		}

		const tl = gsap.timeline({
			onComplete: () => {
				transitionTimeline = null;
			},
		});
		// Phase 1 (parallel): rotate to dropR + finish the z rise. The drag
		// start may have been killed before z reached topZ * Z_STEP (e.g.
		// quick click), so we always tween z back up here. Rotation
		// duration scales with distance — small distance ≈ 0 duration.
		const rotDistance = Math.abs(dropR - d.rotation.z);
		const rotDuration = Math.min(0.8, rotDistance * 3);
		const targetZ = topZ * Z_STEP;
		const zDuration = Math.abs(d.position.z - targetZ) > 1e-5 ? 0.18 : 0;
		const phase1End = Math.max(rotDuration, zDuration);
		tl.to(
			d.position,
			{
				z: targetZ,
				duration: zDuration,
				ease: 'expo.out',
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
		// Hand-off to the stick phase: clear the transition flag, mark stuck,
		// and let updateCoverageAndLifts animate lift back to 0. Fires once
		// both the rotation and z tweens above have completed.
		tl.call(
			() => {
				transitioningIndex = -1;
				stuckIndex = droppedIdx;
				updateCoverageAndLifts();
				requestRender();
			},
			undefined,
			phase1End,
		);
		// Phase 2 (stick): scale settles to 1 alongside the lift drop.
		// Rotation is already at dropR — no rotation tween here, so it can't
		// keep moving while the postit is gluing to the wall.
		tl.to(
			d.scale,
			{
				x: 1,
				y: 1,
				z: 1,
				duration: 0.35,
				ease: 'expo.out',
				onUpdate: requestRender,
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
