import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const KOI_COUNT = 22
const POND_RADIUS = 11.4
const WATER_Y = 0.02

const palette = {
  kohaku: { body: 0xf4f0e6, marks: 0xc23a2b, fin: 0xe8d8c4 },
  sanke: { body: 0xf7f3ea, marks: 0xb43328, accent: 0x1a1512, fin: 0xeee4d4 },
  showa: { body: 0x1c1612, marks: 0xc4452c, accent: 0xf3ece0, fin: 0x2a221c },
  ogon: { body: 0xd4b45a, marks: 0xf0d98a, fin: 0xc9a24a },
  asagi: { body: 0x6a8aa0, marks: 0xd8c4b0, fin: 0xc9b39a },
  bekko: { body: 0xf2ece0, marks: 0x2a2218, fin: 0xe6d8c4 },
  utsuri: { body: 0x161310, marks: 0xe0c056, fin: 0x241c14 },
  tancho: { body: 0xf6f1e6, marks: 0xc12e24, fin: 0xeee2d0 },
}

const varieties = [
  'kohaku', 'sanke', 'showa', 'ogon', 'asagi', 'bekko',
  'utsuri', 'tancho', 'kohaku', 'sanke', 'ogon', 'showa',
  'asagi', 'kohaku', 'bekko', 'utsuri', 'sanke', 'ogon',
  'tancho', 'showa', 'kohaku', 'asagi',
]

const app = document.getElementById('app')
const feedBtn = document.getElementById('feedBtn')
const viewBtn = document.getElementById('viewBtn')
const hourBtn = document.getElementById('hourBtn')

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x7aa3b8)
scene.fog = new THREE.FogExp2(0x8eb4c4, 0.018)

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220)
camera.position.set(16, 9.5, 18)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 6
controls.maxDistance = 42
controls.maxPolarAngle = Math.PI * 0.48
controls.target.set(0, 0.6, 0)
controls.autoRotate = true
controls.autoRotateSpeed = 0.42

const clock = new THREE.Clock()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

let goldenHour = false
let cameraMode = 0
const cameraModes = ['Orbit', 'Waterfall', 'Lotus', 'Follow']
let followIndex = 0

const pellets = []
const splashes = []
const koi = []

const hemi = new THREE.HemisphereLight(0xb8d4e8, 0x3a4a32, 0.85)
scene.add(hemi)

const sun = new THREE.DirectionalLight(0xfff4dd, 1.35)
sun.position.set(18, 22, 10)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 2
sun.shadow.camera.far = 80
sun.shadow.camera.left = -28
sun.shadow.camera.right = 28
sun.shadow.camera.top = 28
sun.shadow.camera.bottom = -28
scene.add(sun)

const fill = new THREE.DirectionalLight(0x9ec8e6, 0.28)
fill.position.set(-12, 8, -10)
scene.add(fill)

const waterfallGlow = new THREE.PointLight(0xcfe8f4, 0.55, 18, 2)
waterfallGlow.position.set(-8.4, 4.2, -7.2)
scene.add(waterfallGlow)

function makeSky() {
  const geo = new THREE.SphereGeometry(120, 32, 24)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x6ea8c6) },
      mid: { value: new THREE.Color(0xcde3ef) },
      bot: { value: new THREE.Color(0xe8d8b8) },
      gold: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 bot;
      uniform float gold;
      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        vec3 day = mix(bot, mix(mid, top, smoothstep(0.35, 0.95, h)), smoothstep(0.05, 0.7, h));
        vec3 duskTop = vec3(0.18, 0.22, 0.38);
        vec3 duskMid = vec3(0.92, 0.48, 0.22);
        vec3 duskBot = vec3(0.98, 0.72, 0.38);
        vec3 eve = mix(duskBot, mix(duskMid, duskTop, smoothstep(0.28, 0.9, h)), smoothstep(0.02, 0.62, h));
        gl_FragColor = vec4(mix(day, eve, gold), 1.0);
      }
    `,
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)
  return mat
}

const skyMat = makeSky()

function addGround() {
  const geo = new THREE.CircleGeometry(48, 72)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4d6a3a,
    roughness: 0.95,
    metalness: 0.02,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -0.22
  mesh.receiveShadow = true
  scene.add(mesh)

  const moss = new THREE.Mesh(
    new THREE.RingGeometry(12.4, 18.5, 64),
    new THREE.MeshStandardMaterial({ color: 0x3e5a32, roughness: 0.98 })
  )
  moss.rotation.x = -Math.PI / 2
  moss.position.y = -0.18
  moss.receiveShadow = true
  scene.add(moss)
}

function createPond() {
  const group = new THREE.Group()

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(POND_RADIUS + 0.55, POND_RADIUS + 0.9, 1.15, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6b675c, roughness: 0.86, metalness: 0.08 })
  )
  basin.position.y = -0.35
  basin.receiveShadow = true
  group.add(basin)

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(POND_RADIUS + 0.42, 0.28, 12, 64),
    new THREE.MeshStandardMaterial({ color: 0x8a8474, roughness: 0.72, metalness: 0.12 })
  )
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.18
  rim.castShadow = true
  group.add(rim)

  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(POND_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x3a4f46, roughness: 1, metalness: 0.04 })
  )
  bed.rotation.x = -Math.PI / 2
  bed.position.y = -0.85
  bed.receiveShadow = true
  group.add(bed)

  const waterGeo = new THREE.CircleGeometry(POND_RADIUS - 0.08, 96)
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      gold: { value: 0 },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 1.4 + time * 1.6) * 0.035 + cos(p.y * 1.7 + time * 1.2) * 0.03;
        p.z += w;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float gold;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c);
        float ripple = sin((r * 28.0) - time * 2.4) * 0.08;
        vec3 deep = mix(vec3(0.10, 0.28, 0.32), vec3(0.18, 0.22, 0.16), gold);
        vec3 shallow = mix(vec3(0.42, 0.72, 0.70), vec3(0.72, 0.52, 0.28), gold);
        vec3 col = mix(deep, shallow, smoothstep(0.18, 0.48, r) + ripple);
        float spark = pow(max(0.0, sin(vPos.x * 6.0 + time * 3.0) * cos(vPos.y * 5.0 - time)), 18.0);
        col += spark * mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.72, 0.28), gold) * 0.35;
        float alpha = 0.72 + ripple * 0.12;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
  const water = new THREE.Mesh(waterGeo, waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.y = WATER_Y
  water.receiveShadow = true
  water.name = 'pondWater'
  group.add(water)

  scene.add(group)
  return water
}

const water = createPond()
addGround()

function stone(x, z, s, y = 0.12) {
  const geo = new THREE.DodecahedronGeometry(s, 0)
  geo.scale(1.4, 0.55, 1.1)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92, metalness: 0.05 })
  )
  mesh.position.set(x, y, z)
  mesh.rotation.y = Math.random() * Math.PI
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

stone(-9.8, 3.2, 0.85)
stone(-10.6, 4.4, 0.55, 0.08)
stone(9.2, -2.4, 0.7)
stone(10.4, -3.6, 0.48)
stone(8.6, 8.8, 0.62)
stone(-3.4, 10.6, 0.5)
stone(4.2, -10.4, 0.58)

function createLantern(x, z) {
  const g = new THREE.Group()
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a7468, roughness: 0.86 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 8), stoneMat)
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.15, 8), stoneMat)
  pillar.position.y = 0.68
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.32, 6), stoneMat)
  roof.position.y = 1.48
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd089 })
  )
  glow.position.y = 1.18
  const light = new THREE.PointLight(0xffc878, 0.0, 7, 2)
  light.position.y = 1.18
  g.add(base, pillar, roof, glow, light)
  g.position.set(x, 0.12, z)
  g.userData.light = light
  g.userData.glow = glow
  scene.add(g)
  return g
}

const lanterns = [
  createLantern(-12.4, -2.2),
  createLantern(12.2, 1.6),
  createLantern(2.4, 13.2),
  createLantern(-1.8, -13.0),
]

function createTree(x, z, scale = 1) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.4 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 })
  )
  trunk.position.y = 1.2 * scale
  trunk.castShadow = true
  g.add(trunk)
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3e, roughness: 0.82 })
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((1.1 - i * 0.12) * scale, 0), canopyMat)
    leaf.position.set((i - 1.4) * 0.25 * scale, (2.1 + i * 0.42) * scale, (i % 2 ? 0.2 : -0.15) * scale)
    leaf.castShadow = true
    g.add(leaf)
  }
  g.position.set(x, 0, z)
  scene.add(g)
}

createTree(-16, -8, 1.35)
createTree(-18, 4, 1.1)
createTree(16, -10, 1.25)
createTree(18.5, 6, 1.45)
createTree(8, 16, 0.95)
createTree(-10, 16.5, 1.2)

function createWaterfall() {
  const g = new THREE.Group()
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 0.9 })
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6.2, 3.6), rockMat)
  cliff.position.set(-8.6, 2.4, -8.8)
  cliff.rotation.y = 0.4
  cliff.castShadow = true
  g.add(cliff)

  const ledge = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.7, 2.2), rockMat)
  ledge.position.set(-8.2, 5.4, -8.0)
  ledge.rotation.y = 0.38
  g.add(ledge)

  for (let i = 0; i < 7; i++) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + Math.random() * 0.4, 0), rockMat)
    boulder.position.set(-10.8 + i * 0.72, 0.4 + (i % 3) * 0.35, -6.6 + (i % 2) * 0.8)
    boulder.castShadow = true
    g.add(boulder)
  }

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x6eb0b4,
      transparent: true,
      opacity: 0.45,
      roughness: 0.15,
      metalness: 0.2,
    })
  )
  pool.rotation.x = -Math.PI / 2
  pool.position.set(-7.6, 0.06, -6.4)
  g.add(pool)

  const count = 900
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -8.6 + (Math.random() - 0.5) * 1.8
    positions[i * 3 + 1] = 1.2 + Math.random() * 4.6
    positions[i * 3 + 2] = -7.5 + (Math.random() - 0.5) * 1.1
    speeds[i] = 2.4 + Math.random() * 2.8
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const pMat = new THREE.PointsMaterial({
    color: 0xd8eef4,
    size: 0.07,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  })
  const drops = new THREE.Points(pGeo, pMat)
  g.add(drops)

  const mistGeo = new THREE.BufferGeometry()
  const mistCount = 180
  const mistPos = new Float32Array(mistCount * 3)
  for (let i = 0; i < mistCount; i++) {
    mistPos[i * 3] = -7.8 + (Math.random() - 0.5) * 2.6
    mistPos[i * 3 + 1] = 0.2 + Math.random() * 1.4
    mistPos[i * 3 + 2] = -6.6 + (Math.random() - 0.5) * 2.2
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3))
  const mist = new THREE.Points(
    mistGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.22, depthWrite: false })
  )
  g.add(mist)

  scene.add(g)
  return { drops, speeds, positions, mist }
}

const waterfall = createWaterfall()

function lotusPad(x, z, r) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, r, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.moveTo(r, 0)
  hole.absarc(r * 0.92, 0, r * 0.18, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false })
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3f7a48,
    roughness: 0.62,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, 0.05, z)
  mesh.castShadow = true
  scene.add(mesh)
  return mesh
}

function lotusBloom(x, z, hue = 0xf2d6e4) {
  const g = new THREE.Group()
  const petalMat = new THREE.MeshStandardMaterial({ color: hue, roughness: 0.45, side: THREE.DoubleSide })
  for (let i = 0; i < 10; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI), petalMat)
    petal.scale.set(0.55, 1.35, 0.22)
    const a = (i / 10) * Math.PI * 2
    petal.position.set(Math.cos(a) * 0.08, 0.12, Math.sin(a) * 0.08)
    petal.rotation.y = -a
    petal.rotation.x = -0.55
    g.add(petal)
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8c04a, roughness: 0.4 })
  )
  center.position.y = 0.16
  g.add(center)
  g.position.set(x, 0.08, z)
  scene.add(g)
  return g
}

const lotus = []
const padSpots = [
  [5.6, 4.8, 0.72],
  [6.8, 3.4, 0.55],
  [4.6, 5.8, 0.48],
  [7.4, 5.6, 0.62],
  [3.4, 3.9, 0.4],
  [-4.8, 6.4, 0.7],
  [-6.2, 5.2, 0.5],
  [-5.4, 7.4, 0.44],
  [2.2, -6.8, 0.66],
  [3.6, -7.6, 0.42],
  [1.1, -5.6, 0.5],
  [-2.4, -7.2, 0.58],
]
for (const [x, z, r] of padSpots) lotus.push(lotusPad(x, z, r))
lotusBloom(5.8, 4.6, 0xf4d0de)
lotusBloom(6.9, 5.4, 0xf7e8f0)
lotusBloom(-5.0, 6.6, 0xefc2d4)
lotusBloom(2.4, -6.6, 0xf8e4ec)
lotusBloom(-2.2, -7.0, 0xe8b7c8)
lotusBloom(4.5, 5.6, 0xf2c8d8)

function createReed(x, z) {
  const g = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const h = 1.1 + Math.random() * 0.9
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, h, 4),
      new THREE.MeshStandardMaterial({ color: 0x4d6b38 })
    )
    stem.position.set((Math.random() - 0.5) * 0.3, h / 2, (Math.random() - 0.5) * 0.3)
    stem.rotation.z = (Math.random() - 0.5) * 0.15
    g.add(stem)
  }
  g.position.set(x, 0, z)
  scene.add(g)
}

for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2 + 0.2
  if (Math.abs(Math.cos(a + 0.8)) > 0.2) {
    createReed(Math.cos(a) * 12.2, Math.sin(a) * 12.2)
  }
}

function createKoiMesh(variety, scale) {
  const colors = palette[variety]
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colors.body,
    roughness: 0.42,
    metalness: 0.18,
  })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyMat)
  body.scale.set(2.15, 0.72, 1.05)
  body.castShadow = true
  g.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), bodyMat)
  head.position.set(0.46, 0.02, 0)
  head.scale.set(1.05, 0.82, 0.9)
  g.add(head)

  const markMat = new THREE.MeshStandardMaterial({ color: colors.marks, roughness: 0.5 })
  const blotchCount = variety === 'ogon' ? 1 : variety === 'tancho' ? 1 : 3 + (variety.length % 2)
  for (let i = 0; i < blotchCount; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 8, 8), markMat)
    b.position.set(-0.18 + i * 0.22, 0.12, (i % 2 ? 0.12 : -0.1) * (variety === 'showa' ? 1.4 : 1))
    b.scale.set(1.4, 0.35, 0.9)
    if (variety === 'tancho') {
      b.position.set(0.5, 0.14, 0)
      b.scale.set(0.55, 0.4, 0.55)
    }
    g.add(b)
  }

  if (colors.accent) {
    const acc = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.5 })
    )
    acc.position.set(-0.05, 0.14, 0.08)
    acc.scale.set(1.1, 0.28, 0.7)
    g.add(acc)
  }

  const finMat = new THREE.MeshStandardMaterial({
    color: colors.fin,
    roughness: 0.55,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  })
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.48, 4), finMat)
  tail.rotation.z = Math.PI / 2
  tail.position.set(-0.72, 0.02, 0)
  tail.scale.set(0.45, 1, 1.15)
  g.add(tail)

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 3), finMat)
  dorsal.position.set(0.05, 0.22, 0)
  dorsal.rotation.z = -0.4
  g.add(dorsal)

  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 3), finMat)
    pec.position.set(0.18, -0.02, 0.2 * side)
    pec.rotation.x = 0.9 * side
    pec.rotation.y = 0.4 * side
    g.add(pec)
  }

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.3 })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat)
    eye.position.set(0.55, 0.06, 0.12 * side)
    g.add(eye)
  }

  g.scale.setScalar(scale)
  g.userData.tail = tail
  g.userData.dorsal = dorsal
  return g
}

function spawnKoi() {
  for (let i = 0; i < KOI_COUNT; i++) {
    const variety = varieties[i]
    const scale = 0.72 + (i % 5) * 0.08 + (i % 3) * 0.04
    const mesh = createKoiMesh(variety, scale)
    const angle = (i / KOI_COUNT) * Math.PI * 2
    const radius = 3.2 + (i % 7) * 0.85
    const fish = {
      mesh,
      variety,
      angle,
      radius,
      depth: -0.22 - (i % 4) * 0.08,
      speed: 0.22 + (i % 6) * 0.05 + Math.random() * 0.08,
      wobble: 1.4 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      hungry: 0,
      target: new THREE.Vector3(),
      feeding: false,
    }
    mesh.position.set(Math.cos(angle) * radius, fish.depth, Math.sin(angle) * radius)
    scene.add(mesh)
    koi.push(fish)
  }
}

spawnKoi()

function tossPellets(x, z, count = 10) {
  const dist = Math.hypot(x, z)
  if (dist > POND_RADIUS - 0.6) {
    const s = (POND_RADIUS - 0.8) / dist
    x *= s
    z *= s
  }
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xc47a32, roughness: 0.8 })
    )
    mesh.position.set(x + (Math.random() - 0.5) * 0.7, 1.4 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.7)
    scene.add(mesh)
    pellets.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      vy: -0.4,
      life: 9 + Math.random() * 4,
      eaten: false,
    })
  }
  addSplash(x, z)
}

function addSplash(x, z) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.12, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.set(x, 0.04, z)
  scene.add(ring)
  splashes.push({ mesh: ring, age: 0 })
}

function feedNearCenter() {
  const a = Math.random() * Math.PI * 2
  const r = 1.2 + Math.random() * 3.4
  tossPellets(Math.cos(a) * r, Math.sin(a) * r, 14)
}

function applyGoldenHour(on) {
  goldenHour = on
  hourBtn.classList.toggle('active', on)
  hourBtn.textContent = on ? 'Daylight' : 'Golden Hour'
  const gold = on ? 1 : 0
  skyMat.uniforms.gold.value = gold
  water.material.uniforms.gold.value = gold
  if (on) {
    scene.background.set(0xc47a3a)
    scene.fog.color.set(0xc47a3a)
    scene.fog.density = 0.022
    sun.color.set(0xffb060)
    sun.intensity = 1.55
    sun.position.set(-16, 8.5, 6)
    hemi.color.set(0xffc078)
    hemi.groundColor.set(0x4a3020)
    hemi.intensity = 0.7
    fill.color.set(0x6a4060)
    renderer.toneMappingExposure = 1.18
    waterfallGlow.color.set(0xffc878)
  } else {
    scene.background.set(0x7aa3b8)
    scene.fog.color.set(0x8eb4c4)
    scene.fog.density = 0.018
    sun.color.set(0xfff4dd)
    sun.intensity = 1.35
    sun.position.set(18, 22, 10)
    hemi.color.set(0xb8d4e8)
    hemi.groundColor.set(0x3a4a32)
    hemi.intensity = 0.85
    fill.color.set(0x9ec8e6)
    renderer.toneMappingExposure = 1.05
    waterfallGlow.color.set(0xcfe8f4)
  }
  lanterns.forEach((l) => {
    l.userData.light.intensity = on ? 1.35 : 0.15
    l.userData.glow.material.color.set(on ? 0xffc060 : 0xffd089)
  })
}

function setCameraMode(mode) {
  cameraMode = mode % cameraModes.length
  viewBtn.textContent = `Camera: ${cameraModes[cameraMode]}`
  if (cameraMode === 0) {
    controls.autoRotate = true
    controls.enabled = true
  } else {
    controls.autoRotate = false
    controls.enabled = cameraMode !== 3
  }
  if (cameraMode === 3) followIndex = (followIndex + 1) % KOI_COUNT
}

feedBtn.addEventListener('click', feedNearCenter)
viewBtn.addEventListener('click', () => setCameraMode(cameraMode + 1))
hourBtn.addEventListener('click', () => applyGoldenHour(!goldenHour))

function pointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect()
  const cx = e.clientX ?? (e.touches && e.touches[0].clientX)
  const cy = e.clientY ?? (e.touches && e.touches[0].clientY)
  pointer.x = ((cx - rect.left) / rect.width) * 2 - 1
  pointer.y = -((cy - rect.top) / rect.height) * 2 + 1
}

let pointerDown = null
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() }
})
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDown) return
  const dx = e.clientX - pointerDown.x
  const dy = e.clientY - pointerDown.y
  const dt = performance.now() - pointerDown.t
  pointerDown = null
  if (Math.hypot(dx, dy) > 8 || dt > 420) return
  pointerFromEvent(e)
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObject(water)
  if (hits.length) {
    const p = hits[0].point
    tossPellets(p.x, p.z, 9)
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function updateWaterfall(dt, t) {
  const pos = waterfall.positions
  for (let i = 0; i < waterfall.speeds.length; i++) {
    pos[i * 3 + 1] -= waterfall.speeds[i] * dt
    pos[i * 3] += Math.sin(t * 3 + i) * 0.002
    if (pos[i * 3 + 1] < 0.08) {
      pos[i * 3] = -8.6 + (Math.random() - 0.5) * 1.8
      pos[i * 3 + 1] = 5.2 + Math.random() * 0.6
      pos[i * 3 + 2] = -7.5 + (Math.random() - 0.5) * 1.1
    }
  }
  waterfall.drops.geometry.attributes.position.needsUpdate = true
  waterfall.mist.material.opacity = 0.16 + Math.sin(t * 1.4) * 0.05
}

function updatePellets(dt) {
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i]
    if (p.eaten) {
      scene.remove(p.mesh)
      pellets.splice(i, 1)
      continue
    }
    p.life -= dt
    if (p.mesh.position.y > 0.07) {
      p.vy -= 4.8 * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.position.z += p.vz * dt
    } else {
      p.mesh.position.y = 0.07
      p.vx *= 0.96
      p.vz *= 0.96
      p.mesh.position.x += p.vx * dt * 0.4
      p.mesh.position.z += p.vz * dt * 0.4
    }
    if (p.life <= 0) {
      scene.remove(p.mesh)
      pellets.splice(i, 1)
    }
  }
}

function nearestPellet(fish) {
  let best = null
  let bestD = 3.8
  for (const p of pellets) {
    if (p.eaten || p.mesh.position.y > 0.2) continue
    const dx = p.mesh.position.x - fish.mesh.position.x
    const dz = p.mesh.position.z - fish.mesh.position.z
    const d = Math.hypot(dx, dz)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

function updateKoi(dt, t) {
  for (const fish of koi) {
    const pellet = nearestPellet(fish)
    if (pellet) {
      fish.feeding = true
      const px = pellet.mesh.position.x
      const pz = pellet.mesh.position.z
      const dx = px - fish.mesh.position.x
      const dz = pz - fish.mesh.position.z
      const d = Math.hypot(dx, dz) || 0.001
      const rush = 1.8
      fish.mesh.position.x += (dx / d) * rush * dt
      fish.mesh.position.z += (dz / d) * rush * dt
      fish.mesh.position.y = THREE.MathUtils.lerp(fish.mesh.position.y, -0.08, 0.08)
      fish.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI / 2
      fish.mesh.rotation.z = Math.sin(t * 10 + fish.phase) * 0.12
      if (fish.mesh.userData.tail) {
        fish.mesh.userData.tail.rotation.y = Math.sin(t * 14 + fish.phase) * 0.5
      }
      if (d < 0.32) {
        pellet.eaten = true
        fish.hungry = 1
      }
      const radial = Math.hypot(fish.mesh.position.x, fish.mesh.position.z)
      if (radial > POND_RADIUS - 1.1) {
        const s = (POND_RADIUS - 1.15) / radial
        fish.mesh.position.x *= s
        fish.mesh.position.z *= s
      }
      continue
    }

    fish.feeding = false
    fish.hungry *= 0.96
    fish.angle += fish.speed * dt * (0.85 + Math.sin(t * 0.3 + fish.phase) * 0.15)
    const wander = 0.55 * Math.sin(t * 0.35 + fish.phase)
    const r = fish.radius + wander
    const x = Math.cos(fish.angle) * r + Math.sin(t * 0.2 + fish.phase) * 0.4
    const z = Math.sin(fish.angle) * r + Math.cos(t * 0.17 + fish.phase) * 0.35
    const y = fish.depth + Math.sin(t * fish.wobble + fish.phase) * 0.06
    fish.mesh.position.x = THREE.MathUtils.lerp(fish.mesh.position.x, x, 0.08)
    fish.mesh.position.z = THREE.MathUtils.lerp(fish.mesh.position.z, z, 0.08)
    fish.mesh.position.y = THREE.MathUtils.lerp(fish.mesh.position.y, y, 0.1)

    const tx = -Math.sin(fish.angle)
    const tz = Math.cos(fish.angle)
    fish.mesh.rotation.y = Math.atan2(tx, tz) + Math.PI / 2
    fish.mesh.rotation.z = Math.sin(t * 3.2 + fish.phase) * 0.08
    fish.mesh.rotation.x = Math.sin(t * 1.6 + fish.phase) * 0.05
    if (fish.mesh.userData.tail) {
      fish.mesh.userData.tail.rotation.y = Math.sin(t * 7 + fish.phase) * 0.45
    }
  }
}

function updateSplashes(dt) {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]
    s.age += dt
    const k = 1 + s.age * 3.2
    s.mesh.scale.setScalar(k)
    s.mesh.material.opacity = Math.max(0, 0.45 - s.age * 0.7)
    if (s.age > 0.8) {
      scene.remove(s.mesh)
      splashes.splice(i, 1)
    }
  }
}

function updateCamera(t) {
  if (cameraMode === 1) {
    const dest = new THREE.Vector3(-2.2, 4.6, 2.4)
    camera.position.lerp(dest, 0.04)
    controls.target.lerp(new THREE.Vector3(-7.4, 1.6, -6.8), 0.04)
  } else if (cameraMode === 2) {
    const dest = new THREE.Vector3(9.4, 3.2, 9.8)
    camera.position.lerp(dest, 0.04)
    controls.target.lerp(new THREE.Vector3(5.4, 0.4, 4.6), 0.04)
  } else if (cameraMode === 3) {
    const fish = koi[followIndex]
    const behind = new THREE.Vector3(
      fish.mesh.position.x - Math.sin(fish.mesh.rotation.y) * 3.4,
      1.6,
      fish.mesh.position.z - Math.cos(fish.mesh.rotation.y) * 3.4
    )
    camera.position.lerp(behind, 0.06)
    controls.target.lerp(fish.mesh.position, 0.08)
  } else {
    controls.target.lerp(new THREE.Vector3(0, 0.6, 0), 0.02)
  }
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.033)
  const t = clock.elapsedTime
  water.material.uniforms.time.value = t
  updateWaterfall(dt, t)
  updatePellets(dt)
  updateKoi(dt, t)
  updateSplashes(dt)
  updateCamera(t)
  lotus.forEach((p, i) => {
    p.position.y = 0.05 + Math.sin(t * 0.8 + i) * 0.012
    p.rotation.z = Math.sin(t * 0.4 + i) * 0.04
  })
  controls.update()
  renderer.render(scene, camera)
}

applyGoldenHour(false)
animate()
