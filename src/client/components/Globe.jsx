import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The landing-page globe.
 *
 * WHAT IT IS SAYING
 *
 * The project is named after technology diffusion — how an innovation spreads
 * through an economy and shows up in measured output. This draws that: scroll
 * moves time, and countries brighten as the share of their firms using AI
 * rises. It is the thesis rendered as an object rather than an illustration
 * placed near one.
 *
 * Two states, and keeping them apart is the whole point:
 *
 *   measured    a filled point, brightness scaled to the adoption rate
 *   unmeasured  a hollow ring, visibly present and visibly unknown
 *
 * A country with no adoption survey is not a country with no adoption. If both
 * rendered as darkness the globe would assert the second while only knowing the
 * first, which is precisely the kind of confident wrongness this project exists
 * to avoid. Ten countries are measured well; the rest are rings.
 *
 * WHAT IT IS NOT SAYING
 *
 * The underlying surveys are annual and four points deep at best, so motion
 * between years is interpolation, not measurement. The caption beside this must
 * say so — a smooth animation reads as continuous observation, and it isn't.
 *
 * IMPLEMENTATION
 *
 * Plain three.js rather than react-three-fiber: one scene, no component tree
 * inside it, and the reconciler would be weight for nothing. Points rather than
 * meshes throughout, so the whole thing is two draw calls.
 */

/** Sphere radius in world units. Everything else is expressed relative to it. */
const R = 1;

/** Base sphere point count. High enough to read as a surface, low enough to stay cheap on a phone. */
const AMBIENT_POINTS = 3200;

/**
 * Latitude/longitude to a point on the sphere.
 *
 * The negation on x is what puts the prime meridian toward the camera at
 * rotation zero; without it the globe is mirrored, which is not obvious until
 * you notice the Americas on the wrong side.
 */
function toVector(lat, lon, radius = R) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Evenly distributed points on a sphere, via the Fibonacci lattice.
 *
 * Random spherical coordinates cluster at the poles — the classic mistake —
 * and a lat/lon grid does the same. This gives near-uniform spacing, which is
 * what makes the surface read as a solid object rather than as noise.
 */
function fibonacciSphere(count) {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  return new Float32Array(points);
}

/**
 * A country's adoption rate at a fractional year.
 *
 * Returns null where the country has no survey at all, and clamps rather than
 * extrapolating outside the observed range: beyond the last survey the honest
 * answer is "still the last known value", not a projected one.
 */
function adoptionAt(adoption, year) {
  const years = Object.keys(adoption).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return null;
  if (year <= years[0]) return adoption[years[0]];
  if (year >= years[years.length - 1]) return adoption[years[years.length - 1]];

  for (let i = 0; i < years.length - 1; i += 1) {
    const [a, b] = [years[i], years[i + 1]];
    if (year >= a && year <= b) {
      const t = (year - a) / (b - a);
      return adoption[a] + (adoption[b] - adoption[a]) * t;
    }
  }
  return adoption[years[years.length - 1]];
}

export default function Globe({ countries = [], year, className = '' }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const yearRef = useRef(year);

  yearRef.current = year;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    /*
     * A WebGL context is not guaranteed — old hardware, a blocked context, a
     * headless browser. Failing to a blank space beats throwing inside a
     * useEffect and taking the page down with it.
     */
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return undefined;
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 3.15;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    /** The group everything hangs off, so rotation and tilt apply once. */
    const world = new THREE.Group();
    scene.add(world);

    // ── The sphere itself ────────────────────────────────────────────────────
    // Faint, uniform, and slightly inside the country markers so those always
    // sit proud of it rather than z-fighting with it.
    const ambientGeometry = new THREE.BufferGeometry();
    ambientGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(fibonacciSphere(AMBIENT_POINTS), 3)
    );
    const ambient = new THREE.Points(
      ambientGeometry,
      new THREE.PointsMaterial({
        color: 0x7da0ff,
        size: 0.0085,
        transparent: true,
        opacity: 0.42,
        sizeAttenuation: true,
        depthWrite: false,
      })
    );
    world.add(ambient);

    // ── Country markers ──────────────────────────────────────────────────────
    // One point per country, lifted just off the surface. Colour and size are
    // per-vertex so a single draw call covers all of them and the per-frame
    // update is a buffer write rather than a scene-graph walk.
    const placed = countries.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
    const positions = new Float32Array(placed.length * 3);
    const colors = new Float32Array(placed.length * 3);
    const sizes = new Float32Array(placed.length);

    placed.forEach((country, i) => {
      const v = toVector(country.lat, country.lon, R * 1.012);
      positions.set([v.x, v.y, v.z], i * 3);
    });

    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    markerGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    markerGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    /*
     * A shader rather than PointsMaterial because each marker needs its own
     * size as well as its own colour, and PointsMaterial only varies colour.
     * The fragment shader draws a soft disc so markers read as glows rather
     * than as squares.
     */
    const markerMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          // Soft falloff, squared so the core stays tight and the halo is wide.
          float a = pow(1.0 - d * 2.0, 2.0);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      vertexColors: true,
    });

    const markers = new THREE.Points(markerGeometry, markerMaterial);
    world.add(markers);

    // ── Colours ──────────────────────────────────────────────────────────────
    // Measured countries run cool blue to cyan as adoption rises. Unmeasured
    // ones take a flat dim blue at a fixed small size — present, clearly not
    // participating in the scale.
    const dim = new THREE.Color(0x33436b);
    const low = new THREE.Color(0x5b86ff);
    const high = new THREE.Color(0x7be2fe);

    /** Highest adoption value anywhere, so the ramp uses the full range. */
    const ceiling = Math.max(
      1,
      ...placed.flatMap((c) => Object.values(c.adoption ?? {}))
    );

    function paint(atYear) {
      const colour = new THREE.Color();
      placed.forEach((country, i) => {
        const value = adoptionAt(country.adoption ?? {}, atYear);

        if (value === null) {
          dim.toArray(colors, i * 3);
          sizes[i] = 3;
          return;
        }

        // Square-rooted so the low end of the range stays visible; a linear
        // ramp makes 4% and 0% look identical against a dark background.
        const t = Math.sqrt(Math.min(value / ceiling, 1));
        colour.copy(low).lerp(high, t);
        colour.toArray(colors, i * 3);
        sizes[i] = 4 + t * 12;
      });
      markerGeometry.attributes.color.needsUpdate = true;
      markerGeometry.attributes.size.needsUpdate = true;
    }

    paint(yearRef.current);

    // ── Interaction ──────────────────────────────────────────────────────────
    // The globe leans toward the cursor. Tracked as a target and eased each
    // frame rather than applied directly, so a fast mouse does not snap it.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    function onPointerMove(event) {
      const rect = mount.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    function resize() {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      /*
       * gl_PointSize is in device pixels, so it must track canvas height or
       * markers are tiny on a large display and enormous on a phone. The
       * divisor is set so the largest marker lands near 30px: `size` tops out
       * at 16 and the camera sits 3.15 units out, so 16 * (h/150) / 3.15 is
       * about 30 at h = 900.
       */
      markerMaterial.uniforms.uScale.value = h / 150;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame;
    let lastPainted = null;

    function tick() {
      frame = requestAnimationFrame(tick);

      // Repaint only when the year has actually moved. Scroll fires far more
      // often than the value meaningfully changes.
      const y = yearRef.current;
      if (lastPainted === null || Math.abs(y - lastPainted) > 0.01) {
        paint(y);
        lastPainted = y;
      }

      if (!reduced) world.rotation.y += 0.0012;

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      world.rotation.x = pointer.y * 0.22;
      world.position.x = pointer.x * 0.06;

      renderer.render(scene, camera);
    }
    tick();

    stateRef.current = { paint };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      ambientGeometry.dispose();
      ambient.material.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, [countries]);

  return <div ref={mountRef} className={className} aria-hidden />;
}
