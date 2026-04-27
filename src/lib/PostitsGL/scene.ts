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
	const textBoostLine = textBoost ? 'transformed.z += uLift * 0.12;' : '';

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

	// ---------- Coverage + hover state ----------

	const aabbs: THREE.Box3[] = groups.map(() => new THREE.Box3());
	const covered: boolean[] = groups.map(() => false);
	let hoveredIndex = -1;
	let draggingIndex = -1;
	// Postit just released from a drag — flat ("stuck") until the cursor
	// leaves and re-enters, regardless of hover state.
	let stuckIndex = -1;

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
				duration: 0.45,
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
	let liftR = 0;
	let dropR = 0;
	let topZ = postits.length;

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

		getWorld(e.clientX, e.clientY, startWorld);
		startPos.set(dragging.position.x, dragging.position.y);
		setHoverX(idx, startWorld.x, startWorld.y);
		originalR = dragging.rotation.z;
		liftR = originalR + ((Math.random() - 0.5) * 10 * Math.PI) / 180;
		dropR = originalR + ((Math.random() - 0.5) * 14 * Math.PI) / 180;

		topZ += 1;
		// Two-phase unstick: while the curl ramps up (~0.4s, see applyTargets)
		// the top stays glued — z holds at its original value. Then the
		// sticky band releases and z snaps up to the top of the stack with
		// a fast settle. Simulates "the top of a postit is glued and more
		// resistant than the rest".
		gsap.to(dragging.position, {
			z: topZ * Z_STEP,
			duration: 0.18,
			delay: 0.4,
			ease: 'expo.out',
			onUpdate: requestRender,
		});

		updateCoverageAndLifts();

		const d = dragging;
		gsap.to(d.scale, {
			x: 1.004,
			y: 1.004,
			z: 1.004,
			duration: 0.32,
			ease: 'power3.in',
			onComplete: () => {
				gsap.to(d.scale, {
					x: 1.03,
					y: 1.03,
					z: 1.03,
					duration: 0.28,
					ease: 'power2.out',
					onComplete: () => {
						gsap.to(d.scale, {
							x: 1.02,
							y: 1.02,
							z: 1.02,
							duration: 0.2,
							ease: 'power1.out',
						});
					},
				});
				gsap.to(d.rotation, {
					z: liftR,
					duration: 0.28,
					ease: 'power2.out',
				});
			},
		});
	}

	const wp = new THREE.Vector2();
	function onPointerMove(e: PointerEvent) {
		if (dragging) {
			getWorld(e.clientX, e.clientY, wp);
			const dx = wp.x - startWorld.x;
			const dy = wp.y - startWorld.y;
			dragging.position.x = Math.max(
				0,
				Math.min(PAPER_W, startPos.x + dx),
			);
			dragging.position.y = Math.max(
				0,
				Math.min(PAPER_H, startPos.y + dy),
			);
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
		releaseHoverX(draggingIndex);
		// Mark this postit as freshly stuck — its lift animates back to 0
		// and stays flat even though the cursor is still over it.
		stuckIndex = draggingIndex;
		dragging = null;
		draggingIndex = -1;
		gsap.killTweensOf(d.scale);
		gsap.killTweensOf(d.rotation);
		gsap.to(d.scale, {
			x: 1,
			y: 1,
			z: 1,
			duration: 0.35,
			ease: 'expo.out',
		});
		gsap.to(d.rotation, { z: dropR, duration: 0.9, ease: 'expo.out' });
		updateCoverageAndLifts();
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
