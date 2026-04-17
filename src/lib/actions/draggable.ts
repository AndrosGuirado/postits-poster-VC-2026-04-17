import gsap from 'gsap';

let topZ = 1;

export function draggable(node: HTMLElement) {
	let startClientX = 0;
	let startClientY = 0;
	let startLeft    = 0;
	let startTop     = 0;
	let originalR    = 0;
	let liftR        = 0;
	let dropR        = 0;

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		node.setPointerCapture(e.pointerId);
		gsap.killTweensOf(node);

		startClientX = e.clientX;
		startClientY = e.clientY;
		startLeft    = parseFloat(node.style.left) || 0;
		startTop     = parseFloat(node.style.top)  || 0;
		originalR    = gsap.getProperty(node, 'rotation') as number;
		liftR        = originalR + (Math.random() - 0.5) * 10;
		dropR        = originalR + (Math.random() - 0.5) * 14;

		node.style.zIndex = '100';

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup',   onPointerUp);

		gsap.to(node, {
			scale:    1.004,
			duration: 0.32,
			ease:     'power3.in',
			onComplete: snap,
		});
	}

	function snap() {
		gsap.to(node, {
			scale:    1.03,
			rotation: liftR,
			filter:   'drop-shadow(4px 6px 8px rgba(0,0,0,0.18))',
			duration: 0.28,
			ease:     'power2.out',
			onComplete: settle,
		});
	}

	function settle() {
		gsap.to(node, {
			scale:    1.02,
			duration: 0.2,
			ease:     'power1.out',
		});
	}

	function onPointerMove(e: PointerEvent) {
		const parent = node.offsetParent as HTMLElement;
		if (!parent) return;

		const rect  = parent.getBoundingClientRect();
		const dx    = ((e.clientX - startClientX) / rect.width)  * 100;
		const dy    = ((e.clientY - startClientY) / rect.height) * 100;
		const left  = Math.max(0, Math.min(100, startLeft + dx));
		const top   = Math.max(0, Math.min(100, startTop  + dy));

		node.style.left = `${left.toFixed(2)}%`;
		node.style.top  = `${top.toFixed(2)}%`;
	}

	function onPointerUp() {
		gsap.killTweensOf(node);
		node.style.zIndex = String(++topZ);

		gsap.to(node, {
			scale:  1,
			filter: 'drop-shadow(4px 6px 8px rgba(0,0,0,0))',
			duration: 0.35,
			ease:     'expo.out',
			onComplete: () => { node.style.filter = ''; },
		});
		gsap.to(node, {
			rotation: dropR,
			duration: 0.9,
			ease:     'expo.out',
		});

		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup',   onPointerUp);
	}

	node.addEventListener('pointerdown', onPointerDown);

	return {
		destroy() {
			gsap.killTweensOf(node);
			node.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup',   onPointerUp);
		},
	};
}
