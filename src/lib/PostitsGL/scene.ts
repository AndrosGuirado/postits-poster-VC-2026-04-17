import * as THREE from 'three/webgpu';
import { CameraHelper, DirectionalLightHelper } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { positionLocal, uniform, smoothstep, float, vec3, uv } from 'three/tsl';
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
const POSTIT_SCALE = POSTIT_W / SVG_W;

const POSTIT_HALF_H = (SVG_H / 2) * POSTIT_SCALE;
const STICKY_FRACTION = 0.2;
const STICKY_END_Y = -POSTIT_HALF_H + STICKY_FRACTION * SVG_H * POSTIT_SCALE;
const LIFT_MAX = 0.015; // peak z-lift at the bottom edge
const PLANE_Y_SEGS = 32;
// Curl is invisible under an orthographic projection unless the paper also
// shortens visibly. Pulling lifted vertices back toward the sticky band fakes
// the foreshortening of the paper rolling toward the viewer.
const CURL_Y_RATIO = 0.4;

const SHADOW_EXPAND = 1.05; // shadow plane is this much larger than the postit
const SHADOW_FADE_FRAC = (1 - 1 / SHADOW_EXPAND) / 2;

const STATIC_SHADOW_OFFSET = 0.0015; // always-on local xy offset (subtle separation)
const STATIC_SHADOW_OPACITY = 0.06; // base opacity for every postit
const LIFT_SHADOW_OFFSET_RATIO = 0.22; // extra downward offset proportional to lift
const LIFT_SHADOW_SPREAD_X = 0.22; // bottom of shadow fans out laterally on lift
const LIFT_SHADOW_OPACITY_PER_LIFT = 0.06 / LIFT_MAX; // extra opacity proportional to lift

const YELLOW = 0xf2f745;
const WHITE = 0xf5f5f0;

type SharedGeometries = {
	yellowBg: THREE.BufferGeometry;
	shadowBg: THREE.BufferGeometry;
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
			const g = new THREE.ShapeGeometry(shape, 24);
			g.translate(-SVG_W / 2, -SVG_H / 2, 0);
			g.scale(POSTIT_SCALE, POSTIT_SCALE, 1);
			// nudge text in z so it draws on top of the bent yellow plane
			g.translate(0, 0, 0.0002);
			blackPaths.push(g);
		});
	});

	const yellowBg = new THREE.PlaneGeometry(
		SVG_W * POSTIT_SCALE,
		SVG_H * POSTIT_SCALE,
		1,
		PLANE_Y_SEGS,
	);
	const shadowBg = new THREE.PlaneGeometry(
		SVG_W * POSTIT_SCALE * SHADOW_EXPAND,
		SVG_H * POSTIT_SCALE * SHADOW_EXPAND,
		1,
		PLANE_Y_SEGS,
	);

	return { yellowBg, shadowBg, blackPaths };
}

type LiftUniform = ReturnType<typeof uniform>;

type PostitMaterials = {
	yellow: THREE.MeshBasicNodeMaterial;
	black: THREE.MeshBasicNodeMaterial;
	shadow: THREE.MeshBasicNodeMaterial;
	lift: LiftUniform;
};

function makePostitMaterials(): PostitMaterials {
	const lift = uniform(0);

	// 0 inside the sticky band, ramps to 1 at the bottom edge.
	const t = smoothstep(
		float(STICKY_END_Y),
		float(POSTIT_HALF_H),
		positionLocal.y,
	);
	const t2 = t.mul(t);
	const liftZ = t2.mul(lift);
	// Pull bent vertices back toward the sticky band so the curl reads
	// visibly even though the camera is orthographic.
	const liftY = t2.mul(lift).mul(float(-CURL_Y_RATIO));

	const liftedPos = vec3(
		positionLocal.x,
		positionLocal.y.add(liftY),
		positionLocal.z.add(liftZ),
	);

	const yellow = new THREE.MeshBasicNodeMaterial({
		color: YELLOW,
		side: THREE.DoubleSide,
	});
	yellow.positionNode = liftedPos;

	const black = new THREE.MeshBasicNodeMaterial({
		color: 0x000000,
		side: THREE.DoubleSide,
	});
	black.positionNode = liftedPos;

	// Shadow stays anchored on the wall while the paper curls upward, so the
	// gap between paper and shadow grows naturally with lift. On lift the
	// shadow's lower vertices extend downward and spread laterally, suggesting
	// a soft penumbra fanning out from the lifted edge.
	const shadowLift = t2.mul(lift);
	const lateralSpread = positionLocal.x
		.mul(shadowLift)
		.mul(float(LIFT_SHADOW_SPREAD_X));
	const downwardOffset = shadowLift.mul(float(LIFT_SHADOW_OFFSET_RATIO));
	const baseOffset = float(STATIC_SHADOW_OFFSET);
	const shadowPos = vec3(
		positionLocal.x.add(lateralSpread).add(baseOffset),
		positionLocal.y.add(downwardOffset).add(baseOffset),
		float(-0.0005),
	);

	const shadow = new THREE.MeshBasicNodeMaterial({
		color: 0x000000,
		transparent: true,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	shadow.positionNode = shadowPos;

	// Soft rectangular edge falloff to fake a blurred drop shadow.
	const shadowUV = uv();
	const fadeIn = float(SHADOW_FADE_FRAC);
	const fadeOut = float(1 - SHADOW_FADE_FRAC);
	const edgeMask = smoothstep(float(0), fadeIn, shadowUV.x)
		.mul(smoothstep(float(1), fadeOut, shadowUV.x))
		.mul(smoothstep(float(0), fadeIn, shadowUV.y))
		.mul(smoothstep(float(1), fadeOut, shadowUV.y));
	const liftAlpha = t2.mul(lift).mul(LIFT_SHADOW_OPACITY_PER_LIFT);
	const totalAlpha = liftAlpha.add(float(STATIC_SHADOW_OPACITY));
	shadow.opacityNode = totalAlpha.mul(edgeMask);

	return { yellow, black, shadow, lift };
}

export function createScene(canvas: HTMLCanvasElement, postits: PostitData[]) {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(WHITE);

	// Y-down ortho cam: top of paper is y=0, bottom is y=PAPER_H.
	const camera = new THREE.OrthographicCamera(
		0,
		PAPER_W,
		0,
		PAPER_H,
		-100,
		100,
	);
	camera.position.z = 10;

	const sharedGeos = buildSharedGeometries();

	const groups: THREE.Group[] = [];
	const mats: PostitMaterials[] = [];

	postits.forEach((p, idx) => {
		const m = makePostitMaterials();
		const g = new THREE.Group();
		const yellowMesh = new THREE.Mesh(sharedGeos.yellowBg, m.yellow);
		yellowMesh.castShadow = true;
		g.add(yellowMesh);
		sharedGeos.blackPaths.forEach((geom) =>
			g.add(new THREE.Mesh(geom, m.black)),
		);
		// Each postit gets its own depth layer so the upper one's shadow can pass
		// the depth test against postits beneath it.
		g.position.set(
			(p.left / 100) * PAPER_W,
			(p.top / 100) * PAPER_H,
			idx * 0.001,
		);
		g.rotation.z = (p.rotate * Math.PI) / 180;
		scene.add(g);
		groups.push(g);
		mats.push(m);
	});

	// ---------- Native shadow setup ----------
	// A wall plane behind the postits receives shadows; the postits cast them.
	// One directional light at a grazing angle drives the shadow direction.
	// The wall sits well behind z=0 so the shadow has room to offset visibly
	// under a near-flat caster (postit z lift is small).
	const WALL_Z = -0.05;
	const wall = new THREE.Mesh(
		new THREE.PlaneGeometry(PAPER_W * 1.6, PAPER_H * 1.6),
		new THREE.ShadowNodeMaterial({ transparent: true, opacity: 0.25 }),
	);
	wall.position.set(PAPER_W / 2, PAPER_H / 2, WALL_Z);
	wall.receiveShadow = true;
	scene.add(wall);

	const sun = new THREE.DirectionalLight(0xffffff, 1);
	sun.position.set(0.1, 0.15, 0.55);
	sun.target.position.set(PAPER_W / 2, PAPER_H / 2, 0);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -1.2;
	sun.shadow.camera.right = 1.2;
	sun.shadow.camera.top = 1.2;
	sun.shadow.camera.bottom = -1.2;
	sun.shadow.camera.near = 0.1;
	sun.shadow.camera.far = 2;
	sun.shadow.bias = -0.0001;
	sun.shadow.radius = 6;
	scene.add(sun);
	scene.add(sun.target);

	const debug =
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('debug') === '1';
	let lightHelper: DirectionalLightHelper | null = null;
	let camHelper: CameraHelper | null = null;
	if (debug) {
		lightHelper = new DirectionalLightHelper(sun, 0.15);
		camHelper = new CameraHelper(sun.shadow.camera);
		scene.add(lightHelper);
		scene.add(camHelper);
	}

	const renderer = new THREE.WebGPURenderer({
		canvas,
		antialias: true,
		alpha: false,
		forceWebGL: typeof navigator !== 'undefined' && !(navigator as any).gpu,
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

	let started = false;
	(async () => {
		await renderer.init();
		resize();
		started = true;
		tick();
	})();

	const ro = new ResizeObserver(resize);
	ro.observe(canvas);

	gsap.ticker.add(requestRender);

	// ---------- Debug controls (tweakpane) ----------
	let pane: Pane | null = null;
	if (debug) {
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
			.addBinding(sun.position, 'x', { min: -1, max: 1.5, step: 0.01 })
			.on('change', onLightChange);
		sunFolder
			.addBinding(sun.position, 'y', { min: -1, max: 1.5, step: 0.01 })
			.on('change', onLightChange);
		sunFolder
			.addBinding(sun.position, 'z', { min: 0.05, max: 2, step: 0.01 })
			.on('change', onLightChange);
		sunFolder
			.addBinding(sun, 'intensity', { min: 0, max: 3, step: 0.05 })
			.on('change', requestRender);

		const shadowFolder = pane.addFolder({ title: 'Shadow' });
		shadowFolder
			.addBinding(sun.shadow, 'radius', { min: 0, max: 20, step: 0.5 })
			.on('change', requestRender);
		shadowFolder
			.addBinding(sun.shadow, 'bias', {
				min: -0.005,
				max: 0.005,
				step: 0.0001,
			})
			.on('change', requestRender);
		const wallMat = wall.material as THREE.ShadowNodeMaterial;
		shadowFolder
			.addBinding(wallMat, 'opacity', { min: 0, max: 1, step: 0.01 })
			.on('change', requestRender);
		shadowFolder
			.addBinding(wall.position, 'z', {
				min: -0.3,
				max: -0.005,
				step: 0.005,
			})
			.on('change', requestRender);
	}

	// ---------- Coverage + hover state ----------

	const aabbs: THREE.Box3[] = groups.map(() => new THREE.Box3());
	const covered: boolean[] = groups.map(() => false);
	let hoveredIndex = -1;
	let draggingIndex = -1;

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
		if (i === draggingIndex || i === hoveredIndex) return LIFT_MAX;
		return 0;
	}

	function applyTargets() {
		for (let i = 0; i < groups.length; i++) {
			const target = targetLiftFor(i);
			const u = mats[i].lift;
			if (u.value === target) continue;
			gsap.killTweensOf(u);
			gsap.to(u, {
				value: target,
				duration: 0.45,
				ease: 'power2.out',
				onUpdate: requestRender,
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
		out.y = ((clientY - rect.top) / rect.height) * PAPER_H;
	}

	function setNdc(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
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
		originalR = dragging.rotation.z;
		liftR = originalR + ((Math.random() - 0.5) * 10 * Math.PI) / 180;
		dropR = originalR + ((Math.random() - 0.5) * 14 * Math.PI) / 180;

		topZ += 1;
		dragging.position.z = topZ * 0.001;

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
			updateCoverageAndLifts();
			requestRender();
			return;
		}
		// Hover detection
		setNdc(e.clientX, e.clientY);
		raycaster.setFromCamera(ndc, camera);
		const idx = pickTopGroupIndex();
		if (idx !== hoveredIndex) {
			hoveredIndex = idx;
			applyTargets();
		}
	}

	function onPointerUp() {
		if (!dragging) return;
		const d = dragging;
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
			sharedGeos.shadowBg.dispose();
			sharedGeos.blackPaths.forEach((g) => g.dispose());
			mats.forEach((m) => {
				m.yellow.dispose();
				m.black.dispose();
				m.shadow.dispose();
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
			if (started) renderer.dispose();
		},
	};
}
